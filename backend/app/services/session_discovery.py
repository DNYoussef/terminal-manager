"""
Session Discovery Service
Scans filesystem for .claude/ directories and parses session data
"""
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime, timezone
from app.config import config

logger = logging.getLogger(__name__)


class SessionInfo:
    """Information about a discovered Claude session"""

    def __init__(
        self,
        session_path: str,
        project_path: str,
        last_activity: Optional[datetime] = None,
        command_count: int = 0,
        recent_commands: Optional[List[str]] = None,
        recent_agents: Optional[List[str]] = None
    ):
        self.session_path = session_path
        self.project_path = project_path
        self.last_activity = last_activity
        self.command_count = command_count
        self.recent_commands = recent_commands or []
        self.recent_agents = recent_agents or []

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'session_path': self.session_path,
            'project_path': self.project_path,
            'project_name': os.path.basename(self.project_path),
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            'command_count': self.command_count,
            'recent_commands': self.recent_commands,
            'recent_agents': self.recent_agents,
        }


class SessionDiscoveryService:
    """Discovers and analyzes Claude Code sessions"""

    def __init__(self):
        self.discovered_sessions: Dict[str, SessionInfo] = {}

    def discover_sessions(self, search_paths: Optional[List[str]] = None) -> List[SessionInfo]:
        """
        Discover Claude sessions by scanning for .claude/ directories

        Args:
            search_paths: Optional list of paths to search.
                         If None, uses allowed directories from config.

        Returns:
            List of SessionInfo objects for discovered sessions
        """
        if search_paths is None:
            search_paths = config.get_allowed_dirs()

        sessions = []

        for search_path in search_paths:
            if not os.path.exists(search_path):
                logger.warning(f"Search path does not exist: {search_path}")
                continue

            try:
                # Search for .claude directories
                for root, dirs, files in os.walk(search_path):
                    if '.claude' in dirs:
                        claude_dir = os.path.join(root, '.claude')
                        project_path = root

                        # Validate path is allowed
                        if not config.validate_path(claude_dir):
                            logger.debug(f"Skipping disallowed path: {claude_dir}")
                            continue

                        # Parse session info
                        session_info = self._parse_session(claude_dir, project_path)

                        if session_info:
                            sessions.append(session_info)
                            self.discovered_sessions[project_path] = session_info

                        # Don't descend into .claude directory
                        dirs.remove('.claude')

            except PermissionError as e:
                logger.warning(f"Permission denied accessing {search_path}: {e}")
            except Exception as e:
                logger.error(f"Error scanning {search_path}: {e}", exc_info=True)

        # Sort by last activity (most recent first)
        sessions.sort(
            key=lambda s: s.last_activity or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )

        logger.info(f"Discovered {len(sessions)} Claude sessions")
        return sessions

    def _parse_session(self, claude_dir: str, project_path: str) -> Optional[SessionInfo]:
        """
        Parse session information from .claude directory

        Args:
            claude_dir: Path to .claude directory
            project_path: Path to project root

        Returns:
            SessionInfo object or None if parsing fails
        """
        try:
            history_file = os.path.join(claude_dir, 'history.jsonl')

            if not os.path.exists(history_file):
                logger.debug(f"No history file found: {history_file}")
                return SessionInfo(
                    session_path=claude_dir,
                    project_path=project_path
                )

            # Parse history.jsonl
            command_count = 0
            recent_commands = []
            recent_agents = set()
            last_activity = None

            # Read last N lines (most recent entries)
            max_lines = 100
            lines = self._tail_file(history_file, max_lines)

            for line in lines:
                try:
                    entry = json.loads(line.strip())
                    command_count += 1

                    # Extract timestamp
                    if 'timestamp' in entry:
                        timestamp = datetime.fromisoformat(entry['timestamp'])
                        if last_activity is None or timestamp > last_activity:
                            last_activity = timestamp

                    # Extract command/message
                    if 'message' in entry and entry.get('role') == 'user':
                        msg = entry['message']
                        if isinstance(msg, str) and len(msg) < 100:
                            if msg not in recent_commands:
                                recent_commands.append(msg)

                    # Extract agent usage (look for Task tool calls)
                    if 'tool_uses' in entry:
                        for tool_use in entry['tool_uses']:
                            if tool_use.get('name') == 'Task':
                                params = tool_use.get('parameters', {})
                                agent_type = params.get('subagent_type')
                                if agent_type:
                                    recent_agents.add(agent_type)

                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.debug(f"Error parsing history entry: {e}")
                    continue

            return SessionInfo(
                session_path=claude_dir,
                project_path=project_path,
                last_activity=last_activity,
                command_count=command_count,
                recent_commands=recent_commands[:10],  # Keep last 10
                recent_agents=sorted(list(recent_agents))[:10]  # Keep top 10
            )

        except Exception as e:
            logger.error(f"Error parsing session {claude_dir}: {e}", exc_info=True)
            return None

    def _tail_file(self, file_path: str, num_lines: int) -> List[str]:
        """
        Read last N lines from a file efficiently

        Args:
            file_path: Path to file
            num_lines: Number of lines to read from end

        Returns:
            List of lines
        """
        try:
            with open(file_path, 'rb') as f:
                # Seek to end
                f.seek(0, os.SEEK_END)
                file_size = f.tell()

                # Read in chunks from end
                block_size = 8192
                blocks = []
                lines_found = 0

                while file_size > 0 and lines_found < num_lines:
                    # Calculate how much to read
                    if file_size < block_size:
                        block_size = file_size

                    # Seek back
                    f.seek(file_size - block_size, os.SEEK_SET)

                    # Read block
                    block = f.read(block_size).decode('utf-8', errors='replace')
                    blocks.append(block)

                    # Count lines
                    lines_found += block.count('\n')

                    # Move position
                    file_size -= block_size

                # Reconstruct and get last N lines
                full_text = ''.join(reversed(blocks))
                lines = full_text.split('\n')

                # Return last N non-empty lines
                return [line for line in lines if line.strip()][-num_lines:]

        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return []

    def get_session(self, project_path: str) -> Optional[SessionInfo]:
        """
        Get session info for a specific project

        Args:
            project_path: Path to project

        Returns:
            SessionInfo or None if not found
        """
        return self.discovered_sessions.get(project_path)


# Global instance
_session_discovery_service: Optional[SessionDiscoveryService] = None


def get_session_discovery_service() -> SessionDiscoveryService:
    """Get global SessionDiscoveryService instance"""
    global _session_discovery_service
    if _session_discovery_service is None:
        _session_discovery_service = SessionDiscoveryService()
    return _session_discovery_service
