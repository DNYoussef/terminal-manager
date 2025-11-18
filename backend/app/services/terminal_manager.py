"""
Terminal Manager Service
Handles spawning, tracking, and streaming terminal sessions

SECURITY HARDENED VERSION - All CRITICAL vulnerabilities fixed:
- Command injection prevention
- Symlink-safe path validation
- Resource limits enforcement
- Config-based whitelisting
- Proper error handling and logging
"""
import asyncio
import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set
import psutil

from app.models.terminal import Terminal, TerminalStatus
from app.db_setup import get_db
from app.config import config
from sqlalchemy.orm import Session

# Setup logging
logger = logging.getLogger(__name__)


class TerminalManager:
    """Manages terminal processes and output streaming with security hardening"""

    def __init__(self):
        self.active_terminals: Dict[str, asyncio.subprocess.Process] = {}
        self.output_tasks: Dict[str, List[asyncio.Task]] = {}  # FIX: Store ALL tasks
        self.subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()
        logger.info("TerminalManager initialized")

    async def spawn(
        self,
        project_id: str,
        working_dir: str,
        db: Session,
        command: str = "claude"
    ) -> Terminal:
        """
        Spawn a new terminal session in the specified directory

        Args:
            project_id: Project ID this terminal belongs to
            working_dir: Directory to run the terminal in
            db: Database session
            command: Command to execute (default: "claude")

        Returns:
            Terminal: Created terminal record

        Raises:
            ValueError: If working_dir is invalid, command not allowed, or limit reached
            RuntimeError: If terminal spawn fails
        """
        # CRITICAL FIX #4: Check terminal limit
        async with self._lock:
            if len(self.active_terminals) >= config.MAX_TERMINALS:
                logger.warning(
                    f"Terminal limit reached: {len(self.active_terminals)}/{config.MAX_TERMINALS}"
                )
                raise ValueError(
                    f"Maximum number of terminals ({config.MAX_TERMINALS}) reached"
                )

        # CRITICAL FIX #1: Validate command whitelist (prevent injection)
        if command not in config.ALLOWED_COMMANDS:
            logger.warning(f"Rejected disallowed command: {command}")
            raise ValueError(
                f"Command '{command}' not allowed. "
                f"Allowed: {', '.join(config.ALLOWED_COMMANDS)}"
            )

        # CRITICAL FIX #2: Symlink-safe path validation
        if not config.validate_path(working_dir):
            logger.warning(f"Path validation failed: {working_dir}")
            raise ValueError(f"Invalid or disallowed path: {working_dir}")

        # Check directory exists
        if not os.path.exists(working_dir):
            logger.warning(f"Directory does not exist: {working_dir}")
            raise ValueError(f"Directory does not exist: {working_dir}")

        # Generate terminal ID
        terminal_id = str(uuid.uuid4())

        try:
            # CRITICAL FIX #1: Prevent command injection
            # Use Set-Location with -LiteralPath to prevent path injection
            # Use call operator & to prevent command injection
            safe_command = (
                f"Set-Location -LiteralPath '{working_dir}'; "
                f"& '{command}'"
            )

            # Spawn PowerShell process
            process = await asyncio.create_subprocess_exec(
                config.TERMINAL_SHELL,
                "-NoProfile", "-NoLogo",
                "-Command", safe_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir
            )

            logger.info(
                f"Spawned terminal PID={process.pid} "
                f"for project={project_id} command={command}"
            )

            # Store process
            async with self._lock:
                self.active_terminals[terminal_id] = process
                self.subscribers[terminal_id] = set()

            # Create database record (use timezone-aware datetime)
            terminal = Terminal(
                id=terminal_id,
                project_id=project_id,
                pid=process.pid,
                working_dir=working_dir,
                status=TerminalStatus.ACTIVE.value,
                created_at=datetime.now(timezone.utc),
                last_activity_at=datetime.now(timezone.utc)
            )

            try:
                db.add(terminal)
                db.commit()
                db.refresh(terminal)
                logger.info(f"Created terminal record: {terminal_id}")
            except Exception as db_error:
                logger.error(f"Failed to create terminal record: {db_error}")
                # Cleanup process before raising
                process.kill()
                await process.wait()
                async with self._lock:
                    self.active_terminals.pop(terminal_id, None)
                raise RuntimeError("Failed to create terminal record")

            # Start output capture tasks (FIX: Store all tasks for cleanup)
            self._start_output_capture(terminal_id, db)

            return terminal

        except ValueError:
            # Re-raise validation errors as-is
            raise
        except RuntimeError:
            # Re-raise runtime errors as-is
            raise
        except OSError as e:
            # OS-level errors (process spawn failures)
            logger.error(f"OS error spawning terminal: {e}")
            raise RuntimeError("Failed to spawn terminal: OS error")
        except Exception as e:
            # Unexpected errors
            logger.error(f"Unexpected error spawning terminal: {e}", exc_info=True)

            # Cleanup on failure
            if terminal_id in self.active_terminals:
                try:
                    process = self.active_terminals[terminal_id]
                    process.kill()
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    logger.warning(f"Process {process.pid} did not terminate, force killing")
                except Exception as cleanup_error:
                    logger.error(f"Error during cleanup: {cleanup_error}")
                finally:
                    async with self._lock:
                        self.active_terminals.pop(terminal_id, None)

            raise RuntimeError("Failed to spawn terminal")

    def _start_output_capture(self, terminal_id: str, db: Session) -> None:
        """
        Start async tasks to capture stdout, stderr, and monitor process

        Args:
            terminal_id: Terminal ID
            db: Database session for status updates
        """
        process = self.active_terminals.get(terminal_id)
        if not process:
            logger.warning(f"Cannot start capture for missing terminal: {terminal_id}")
            return

        # Create all three output capture tasks
        stdout_task = asyncio.create_task(
            self._capture_output(terminal_id, process.stdout, "stdout")
        )
        stderr_task = asyncio.create_task(
            self._capture_output(terminal_id, process.stderr, "stderr")
        )
        monitor_task = asyncio.create_task(
            self._monitor_process(terminal_id, process, db)
        )

        # FIX: Store ALL tasks (not just stdout) for proper cleanup
        self.output_tasks[terminal_id] = [stdout_task, stderr_task, monitor_task]

        logger.debug(f"Started output capture tasks for terminal {terminal_id}")

    async def _capture_output(
        self,
        terminal_id: str,
        stream,
        stream_type: str
    ) -> None:
        """
        Capture output from stream and broadcast to subscribers

        Args:
            terminal_id: Terminal ID
            stream: stdout or stderr stream
            stream_type: "stdout" or "stderr"
        """
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break

                # Decode with configured encoding
                decoded_line = line.decode(
                    config.TERMINAL_ENCODING,
                    errors='replace'
                ).strip()

                if not decoded_line:
                    continue

                # Broadcast to all subscribers
                await self._broadcast(terminal_id, {
                    'terminal_id': terminal_id,
                    'type': stream_type,
                    'line': decoded_line,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })

        except asyncio.CancelledError:
            logger.debug(f"Output capture cancelled for {terminal_id} ({stream_type})")
            raise
        except Exception as e:
            logger.error(
                f"Error capturing {stream_type} for terminal {terminal_id}: {e}",
                exc_info=True
            )

    async def _monitor_process(
        self,
        terminal_id: str,
        process: asyncio.subprocess.Process,
        db: Session
    ) -> None:
        """
        Monitor process status and update database

        Args:
            terminal_id: Terminal ID
            process: Process to monitor
            db: Database session for status updates
        """
        try:
            # Wait for process to exit
            exit_code = await process.wait()

            logger.info(
                f"Terminal {terminal_id} process exited with code {exit_code}"
            )

            # Update status to stopped
            async with self._lock:
                self.active_terminals.pop(terminal_id, None)

            # CRITICAL FIX #6: Update database with status (was missing)
            try:
                terminal = db.query(Terminal).filter(
                    Terminal.id == terminal_id
                ).first()

                if terminal:
                    terminal.status = TerminalStatus.STOPPED.value
                    terminal.last_activity_at = datetime.now(timezone.utc)
                    db.commit()
                    logger.info(f"Updated terminal {terminal_id} status to STOPPED")
                else:
                    logger.warning(f"Terminal record not found: {terminal_id}")

            except Exception as db_error:
                logger.error(
                    f"Failed to update terminal status in DB: {db_error}",
                    exc_info=True
                )
                db.rollback()

            # Broadcast termination
            await self._broadcast(terminal_id, {
                'terminal_id': terminal_id,
                'type': 'status',
                'status': 'stopped',
                'exit_code': exit_code,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })

        except asyncio.CancelledError:
            logger.debug(f"Process monitoring cancelled for {terminal_id}")
            raise
        except Exception as e:
            logger.error(
                f"Error monitoring process {terminal_id}: {e}",
                exc_info=True
            )

    async def _broadcast(self, terminal_id: str, message: dict) -> None:
        """
        Broadcast message to all subscribers of this terminal

        Args:
            terminal_id: Terminal ID
            message: Message dict to broadcast
        """
        subscribers = self.subscribers.get(terminal_id, set())

        if not subscribers:
            return

        # Broadcast to all subscribers
        for queue in list(subscribers):  # Copy to avoid modification during iteration
            try:
                await asyncio.wait_for(
                    queue.put(message),
                    timeout=config.QUEUE_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"Queue timeout for terminal {terminal_id}, subscriber unresponsive"
                )
            except Exception as e:
                logger.error(f"Error broadcasting to subscriber: {e}")

    async def subscribe(self, terminal_id: str) -> asyncio.Queue:
        """
        Subscribe to terminal output

        Args:
            terminal_id: Terminal ID to subscribe to

        Returns:
            asyncio.Queue: Queue that will receive output messages

        Raises:
            ValueError: If subscriber limit reached
        """
        async with self._lock:
            # CRITICAL FIX #4: Check subscriber limit
            current_subscribers = len(self.subscribers.get(terminal_id, set()))
            if current_subscribers >= config.MAX_SUBSCRIBERS_PER_TERMINAL:
                logger.warning(
                    f"Subscriber limit reached for terminal {terminal_id}: "
                    f"{current_subscribers}/{config.MAX_SUBSCRIBERS_PER_TERMINAL}"
                )
                raise ValueError(
                    f"Maximum subscribers ({config.MAX_SUBSCRIBERS_PER_TERMINAL}) "
                    f"reached for terminal {terminal_id}"
                )

            # Create queue with configured size
            queue = asyncio.Queue(maxsize=config.OUTPUT_QUEUE_SIZE)

            if terminal_id not in self.subscribers:
                self.subscribers[terminal_id] = set()

            self.subscribers[terminal_id].add(queue)

            logger.debug(
                f"Added subscriber to terminal {terminal_id} "
                f"({len(self.subscribers[terminal_id])} total)"
            )

        return queue

    async def unsubscribe(self, terminal_id: str, queue: asyncio.Queue) -> None:
        """
        Unsubscribe from terminal output

        Args:
            terminal_id: Terminal ID to unsubscribe from
            queue: Queue to remove
        """
        async with self._lock:
            if terminal_id in self.subscribers:
                self.subscribers[terminal_id].discard(queue)
                logger.debug(
                    f"Removed subscriber from terminal {terminal_id} "
                    f"({len(self.subscribers[terminal_id])} remaining)"
                )

    async def list(self, db: Session) -> List[Terminal]:
        """
        List all terminals

        Args:
            db: Database session

        Returns:
            List[Terminal]: List of all terminal records
        """
        try:
            terminals = db.query(Terminal).all()
            return terminals
        except Exception as e:
            logger.error(f"Failed to list terminals: {e}")
            return []

    async def get(self, terminal_id: str, db: Session) -> Optional[Terminal]:
        """
        Get terminal by ID

        Args:
            terminal_id: Terminal ID
            db: Database session

        Returns:
            Optional[Terminal]: Terminal record or None
        """
        try:
            terminal = db.query(Terminal).filter(
                Terminal.id == terminal_id
            ).first()
            return terminal
        except Exception as e:
            logger.error(f"Failed to get terminal {terminal_id}: {e}")
            return None

    async def stop(self, terminal_id: str, db: Session) -> None:
        """
        Stop a terminal session

        Args:
            terminal_id: Terminal ID to stop
            db: Database session

        Raises:
            ValueError: If terminal not found
        """
        async with self._lock:
            process = self.active_terminals.get(terminal_id)
            if not process:
                raise ValueError(
                    f"Terminal {terminal_id} not found or already stopped"
                )

            # Terminate process gracefully, then kill if needed
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5.0)
                logger.info(f"Terminated terminal {terminal_id} gracefully")
            except asyncio.TimeoutError:
                logger.warning(f"Terminal {terminal_id} did not terminate, killing")
                process.kill()
                await process.wait()
            except Exception as e:
                logger.error(f"Error stopping terminal {terminal_id}: {e}")

            # Remove from active terminals
            self.active_terminals.pop(terminal_id, None)

            # Cancel ALL output tasks (FIX: Cancel all, not just first)
            if terminal_id in self.output_tasks:
                for task in self.output_tasks[terminal_id]:
                    task.cancel()
                self.output_tasks.pop(terminal_id, None)

        # Update database
        try:
            terminal = db.query(Terminal).filter(
                Terminal.id == terminal_id
            ).first()
            if terminal:
                terminal.status = TerminalStatus.STOPPED.value
                terminal.last_activity_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"Updated terminal {terminal_id} status to STOPPED in DB")
        except Exception as e:
            logger.error(f"Failed to update terminal status in DB: {e}")
            db.rollback()

    async def get_status(self, terminal_id: str, db: Session) -> dict:
        """
        Get terminal status including process info

        Args:
            terminal_id: Terminal ID
            db: Database session

        Returns:
            dict: Status information
        """
        terminal = await self.get(terminal_id, db)
        if not terminal:
            return {'error': 'Terminal not found'}

        process = self.active_terminals.get(terminal_id)

        status = {
            'id': terminal.id,
            'project_id': terminal.project_id,
            'working_dir': terminal.working_dir,
            'status': terminal.status,
            'created_at': terminal.created_at.isoformat(),
            'last_activity_at': terminal.last_activity_at.isoformat(),
        }

        if process:
            try:
                # Get process info using psutil
                proc = psutil.Process(process.pid)
                status.update({
                    'pid': process.pid,
                    'is_running': proc.is_running(),
                    'cpu_percent': proc.cpu_percent(),
                    'memory_mb': round(proc.memory_info().rss / 1024 / 1024, 2),
                })
            except psutil.NoSuchProcess:
                status['pid'] = process.pid
                status['is_running'] = False
            except Exception as e:
                logger.error(f"Error getting process info: {e}")
                status['pid'] = process.pid
                status['is_running'] = process.returncode is None

        return status

    async def cleanup(self) -> None:
        """Cleanup all active terminals (called on shutdown)"""
        logger.info("Starting terminal manager cleanup")

        async with self._lock:
            # Terminate all processes
            for terminal_id, process in list(self.active_terminals.items()):
                try:
                    process.terminate()
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                    logger.debug(f"Terminated terminal {terminal_id}")
                except asyncio.TimeoutError:
                    logger.warning(f"Killing terminal {terminal_id} (did not terminate)")
                    process.kill()
                except Exception as e:
                    logger.error(f"Error cleaning up terminal {terminal_id}: {e}")

            self.active_terminals.clear()
            self.subscribers.clear()

            # Cancel all output tasks
            for terminal_id, tasks in self.output_tasks.items():
                for task in tasks:
                    task.cancel()

            self.output_tasks.clear()

        logger.info("Terminal manager cleanup complete")


# Global instance
_terminal_manager: Optional[TerminalManager] = None


def get_terminal_manager() -> TerminalManager:
    """Get global TerminalManager instance (dependency injection)"""
    global _terminal_manager
    if _terminal_manager is None:
        _terminal_manager = TerminalManager()
    return _terminal_manager
