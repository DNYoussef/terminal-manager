"""
Terminal endpoints for streaming and management
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging
import asyncio

from app.db_setup import get_db
from app.models.terminal import Terminal
from app.services.terminal_manager import get_terminal_manager, TerminalManager

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/terminals", tags=["terminals"])


@router.get("/", response_model=List[dict])
async def list_terminals(
    db: Session = Depends(get_db),
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    List all terminals with their current status

    Returns:
        List[dict]: List of terminal records with status information
    """
    try:
        terminals = await terminal_manager.list(db)

        # Get status for each terminal
        terminal_list = []
        for terminal in terminals:
            status = await terminal_manager.get_status(terminal.id, db)
            terminal_list.append(status)

        logger.info(f"Listed {len(terminal_list)} terminals")
        return terminal_list

    except Exception as e:
        logger.error(f"Error listing terminals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list terminals")


@router.get("/{terminal_id}/status")
async def get_terminal_status(
    terminal_id: str,
    db: Session = Depends(get_db),
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    Get detailed status for a specific terminal

    Args:
        terminal_id: Terminal ID
        db: Database session
        terminal_manager: Terminal manager instance

    Returns:
        dict: Terminal status information

    Raises:
        HTTPException: If terminal not found
    """
    status = await terminal_manager.get_status(terminal_id, db)

    if 'error' in status:
        logger.warning(f"Terminal not found: {terminal_id}")
        raise HTTPException(status_code=404, detail="Terminal not found")

    return status


@router.websocket("/{terminal_id}/stream")
async def terminal_stream(
    websocket: WebSocket,
    terminal_id: str,
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    WebSocket endpoint for streaming terminal output in real-time

    Args:
        websocket: WebSocket connection
        terminal_id: Terminal ID to stream from
        terminal_manager: Terminal manager instance

    Flow:
        1. Accept WebSocket connection
        2. Subscribe to terminal output
        3. Stream output messages to client
        4. Handle disconnection and cleanup
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for terminal {terminal_id}")

    # Get database session
    from app.db_setup import SessionLocal
    db = SessionLocal()

    try:
        # Verify terminal exists
        terminal = await terminal_manager.get(terminal_id, db)
        if not terminal:
            logger.warning(f"Terminal not found for streaming: {terminal_id}")
            await websocket.send_json({
                'type': 'error',
                'message': 'Terminal not found'
            })
            await websocket.close(code=1008, reason="Terminal not found")
            return

        # Subscribe to terminal output
        try:
            queue = await terminal_manager.subscribe(terminal_id)
        except ValueError as e:
            logger.warning(f"Subscription failed for {terminal_id}: {e}")
            await websocket.send_json({
                'type': 'error',
                'message': str(e)
            })
            await websocket.close(code=1008, reason="Subscription limit reached")
            return

        logger.info(f"Subscribed to terminal {terminal_id} output")

        # Send initial connection success message
        await websocket.send_json({
            'type': 'connected',
            'terminal_id': terminal_id,
            'message': 'Connected to terminal stream'
        })

        # Stream output to WebSocket client
        try:
            while True:
                # Get next output message from queue
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=1.0)

                    # Send to WebSocket client
                    await websocket.send_json(message)

                    # If terminal stopped, close connection
                    if message.get('type') == 'status' and message.get('status') == 'stopped':
                        logger.info(f"Terminal {terminal_id} stopped, closing WebSocket")
                        break

                except asyncio.TimeoutError:
                    # Send keepalive ping every second of no output
                    try:
                        await websocket.send_json({
                            'type': 'ping',
                            'terminal_id': terminal_id
                        })
                    except:
                        # Client disconnected
                        break

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for terminal {terminal_id}")
        except Exception as e:
            logger.error(f"Error streaming terminal {terminal_id}: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    'type': 'error',
                    'message': 'Streaming error occurred'
                })
            except:
                pass

    finally:
        # Cleanup: unsubscribe from terminal output
        if 'queue' in locals():
            await terminal_manager.unsubscribe(terminal_id, queue)
            logger.debug(f"Unsubscribed from terminal {terminal_id}")

        # Close database session
        db.close()

        # Close WebSocket if still open
        try:
            await websocket.close()
        except:
            pass

        logger.info(f"WebSocket cleanup complete for terminal {terminal_id}")


@router.post("/{terminal_id}/stop")
async def stop_terminal(
    terminal_id: str,
    db: Session = Depends(get_db),
    terminal_manager: TerminalManager = Depends(get_terminal_manager)
):
    """
    Stop a running terminal

    Args:
        terminal_id: Terminal ID to stop
        db: Database session
        terminal_manager: Terminal manager instance

    Returns:
        dict: Success message

    Raises:
        HTTPException: If terminal not found or stop fails
    """
    try:
        await terminal_manager.stop(terminal_id, db)
        logger.info(f"Stopped terminal {terminal_id}")

        return {
            'success': True,
            'message': f'Terminal {terminal_id} stopped'
        }

    except ValueError as e:
        logger.warning(f"Stop failed: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error stopping terminal {terminal_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to stop terminal")
