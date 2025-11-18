"""
WebSocket Connection Manager
Manages WebSocket connections and broadcasts events to connected clients
"""

import json
from typing import Dict, List, Set, Optional
from datetime import datetime
import asyncio
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Manages WebSocket connections with user-based routing"""

    def __init__(self):
        # All active connections
        self.active_connections: List[WebSocket] = []

        # User ID to WebSocket mapping (one user can have multiple connections)
        self.user_connections: Dict[int, List[WebSocket]] = {}

        # Connection metadata
        self.connection_metadata: Dict[WebSocket, dict] = {}

        # Statistics
        self.stats = {
            "total_connections": 0,
            "total_disconnections": 0,
            "messages_sent": 0,
            "errors": 0
        }

    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None, metadata: Optional[dict] = None):
        """
        Connect a new WebSocket client

        Args:
            websocket: WebSocket connection
            user_id: User ID for targeted messaging
            metadata: Additional connection metadata
        """
        await websocket.accept()

        self.active_connections.append(websocket)
        self.stats["total_connections"] += 1

        # Store user mapping
        if user_id is not None:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)

        # Store metadata
        self.connection_metadata[websocket] = {
            "user_id": user_id,
            "connected_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        print(f"WebSocket connected: user_id={user_id}, total_connections={len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """
        Disconnect a WebSocket client

        Args:
            websocket: WebSocket connection to remove
        """
        # Remove from active connections
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        # Remove from user connections
        metadata = self.connection_metadata.get(websocket, {})
        user_id = metadata.get("user_id")

        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)

            # Clean up empty user lists
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Remove metadata
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]

        self.stats["total_disconnections"] += 1

        print(f"WebSocket disconnected: user_id={user_id}, total_connections={len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """
        Send message to specific WebSocket connection

        Args:
            message: Message to send
            websocket: Target WebSocket
        """
        try:
            await websocket.send_text(message)
            self.stats["messages_sent"] += 1
        except Exception as e:
            self.stats["errors"] += 1
            print(f"Error sending personal message: {e}")

    async def send_to_user(self, user_id: int, data: dict):
        """
        Send message to all connections for a specific user

        Args:
            user_id: Target user ID
            data: Data to send (will be JSON serialized)
        """
        if user_id not in self.user_connections:
            print(f"No active connections for user {user_id}")
            return

        message = json.dumps(data)
        connections = self.user_connections[user_id].copy()

        for websocket in connections:
            try:
                await websocket.send_text(message)
                self.stats["messages_sent"] += 1
            except Exception as e:
                self.stats["errors"] += 1
                print(f"Error sending to user {user_id}: {e}")
                # Connection is broken, disconnect it
                self.disconnect(websocket)

    async def broadcast(self, data: dict, exclude: Optional[Set[WebSocket]] = None):
        """
        Broadcast message to all connected clients

        Args:
            data: Data to broadcast (will be JSON serialized)
            exclude: Set of WebSockets to exclude from broadcast
        """
        message = json.dumps(data)
        exclude = exclude or set()

        # Create a copy of connections to avoid issues if connections change during iteration
        connections = self.active_connections.copy()

        for websocket in connections:
            if websocket not in exclude:
                try:
                    await websocket.send_text(message)
                    self.stats["messages_sent"] += 1
                except Exception as e:
                    self.stats["errors"] += 1
                    print(f"Error broadcasting: {e}")
                    # Connection is broken, disconnect it
                    self.disconnect(websocket)

    async def broadcast_to_users(self, user_ids: List[int], data: dict):
        """
        Broadcast message to specific users

        Args:
            user_ids: List of user IDs to broadcast to
            data: Data to broadcast
        """
        for user_id in user_ids:
            await self.send_to_user(user_id, data)

    def get_connected_users(self) -> List[int]:
        """Get list of currently connected user IDs"""
        return list(self.user_connections.keys())

    def get_connection_count(self, user_id: Optional[int] = None) -> int:
        """
        Get connection count

        Args:
            user_id: If provided, get count for specific user

        Returns:
            Number of active connections
        """
        if user_id is not None:
            return len(self.user_connections.get(user_id, []))
        return len(self.active_connections)

    def get_stats(self) -> dict:
        """Get connection manager statistics"""
        return {
            **self.stats,
            "active_connections": len(self.active_connections),
            "unique_users": len(self.user_connections),
            "connections_by_user": {
                user_id: len(connections)
                for user_id, connections in self.user_connections.items()
            }
        }

    async def send_ping(self, websocket: WebSocket):
        """
        Send ping to keep connection alive

        Args:
            websocket: WebSocket to ping
        """
        try:
            await websocket.send_json({"type": "ping", "timestamp": datetime.now().isoformat()})
        except Exception as e:
            print(f"Error sending ping: {e}")
            self.disconnect(websocket)


# Global connection manager instance
connection_manager = ConnectionManager()


# Heartbeat task to keep connections alive
async def heartbeat_task(interval: int = 30):
    """
    Periodic heartbeat to keep connections alive

    Args:
        interval: Seconds between heartbeats
    """
    while True:
        await asyncio.sleep(interval)

        print(f"Sending heartbeat to {len(connection_manager.active_connections)} connections")

        for websocket in connection_manager.active_connections.copy():
            await connection_manager.send_ping(websocket)
