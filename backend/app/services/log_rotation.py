"""
Log Rotation Service
Manages log file rotation, compression, and cleanup
Integrates with structured logger for production observability
"""

import os
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)


class LogRotationService:
    """Service for managing log file rotation and cleanup"""

    def __init__(
        self,
        log_directory: str = "logs",
        max_age_days: int = 30,
        max_size_mb: int = 100,
        compress_old_logs: bool = True
    ):
        """
        Initialize log rotation service

        Args:
            log_directory: Directory containing log files
            max_age_days: Maximum age of logs to keep (in days)
            max_size_mb: Maximum size of individual log files (in MB)
            compress_old_logs: Whether to compress rotated logs
        """
        self.log_directory = Path(log_directory)
        self.max_age_days = max_age_days
        self.max_size_mb = max_size_mb
        self.compress_old_logs = compress_old_logs

        # Ensure log directory exists
        self.log_directory.mkdir(parents=True, exist_ok=True)

    def rotate_logs(self) -> Dict[str, any]:
        """
        Perform log rotation

        Returns:
            Dictionary with rotation statistics
        """
        stats = {
            "rotated_files": 0,
            "compressed_files": 0,
            "deleted_files": 0,
            "total_size_freed_mb": 0.0
        }

        try:
            # Rotate large files
            rotated = self._rotate_large_files()
            stats["rotated_files"] = len(rotated)

            # Compress old files
            if self.compress_old_logs:
                compressed = self._compress_old_files()
                stats["compressed_files"] = len(compressed)

            # Delete old files
            deleted, size_freed = self._delete_old_files()
            stats["deleted_files"] = len(deleted)
            stats["total_size_freed_mb"] = size_freed

            logger.info(f"Log rotation complete: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Log rotation failed: {e}")
            raise

    def _rotate_large_files(self) -> List[Path]:
        """Rotate log files exceeding max size"""
        rotated_files = []
        max_size_bytes = self.max_size_mb * 1024 * 1024

        for log_file in self.log_directory.glob("*.log"):
            if log_file.stat().st_size > max_size_bytes:
                timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                rotated_name = f"{log_file.stem}-{timestamp}.log"
                rotated_path = log_file.parent / rotated_name

                try:
                    shutil.move(str(log_file), str(rotated_path))
                    rotated_files.append(rotated_path)
                    logger.info(f"Rotated large log file: {log_file} -> {rotated_path}")
                except Exception as e:
                    logger.error(f"Failed to rotate {log_file}: {e}")

        return rotated_files

    def _compress_old_files(self) -> List[Path]:
        """Compress rotated log files"""
        compressed_files = []

        # Compress .log files that are not the current day's log
        today = datetime.now().strftime("%Y-%m-%d")

        for log_file in self.log_directory.glob("*.log"):
            # Skip current day's main log files
            if today in log_file.stem and not any(
                timestamp in log_file.stem for timestamp in ["-202", "T"]
            ):
                continue

            compressed_path = log_file.with_suffix(".log.gz")

            # Skip if already compressed
            if compressed_path.exists():
                continue

            try:
                with open(log_file, 'rb') as f_in:
                    with gzip.open(compressed_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)

                # Remove original after successful compression
                log_file.unlink()
                compressed_files.append(compressed_path)
                logger.info(f"Compressed log file: {log_file}")

            except Exception as e:
                logger.error(f"Failed to compress {log_file}: {e}")

        return compressed_files

    def _delete_old_files(self) -> tuple[List[Path], float]:
        """Delete log files older than max_age_days"""
        deleted_files = []
        total_size_freed = 0.0
        cutoff_date = datetime.now() - timedelta(days=self.max_age_days)

        for log_file in self.log_directory.glob("*.log*"):
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)

            if file_mtime < cutoff_date:
                try:
                    file_size = log_file.stat().st_size
                    log_file.unlink()
                    deleted_files.append(log_file)
                    total_size_freed += file_size / (1024 * 1024)  # Convert to MB
                    logger.info(f"Deleted old log file: {log_file}")

                except Exception as e:
                    logger.error(f"Failed to delete {log_file}: {e}")

        return deleted_files, total_size_freed

    def get_log_files_info(self) -> List[Dict[str, any]]:
        """
        Get information about all log files

        Returns:
            List of dictionaries with file information
        """
        files_info = []

        for log_file in sorted(self.log_directory.glob("*.log*")):
            stat = log_file.stat()
            files_info.append({
                "filename": log_file.name,
                "path": str(log_file),
                "size_mb": stat.st_size / (1024 * 1024),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "compressed": log_file.suffix == ".gz"
            })

        return files_info

    def read_log_entries(
        self,
        filename: str,
        limit: int = 100,
        offset: int = 0,
        filters: Optional[Dict[str, any]] = None
    ) -> List[Dict[str, any]]:
        """
        Read and parse log entries from a file

        Args:
            filename: Name of log file to read
            limit: Maximum number of entries to return
            offset: Number of entries to skip
            filters: Optional filters to apply

        Returns:
            List of parsed log entries
        """
        log_file = self.log_directory / filename
        if not log_file.exists():
            raise FileNotFoundError(f"Log file not found: {filename}")

        entries = []
        filters = filters or {}

        try:
            # Handle compressed files
            if log_file.suffix == ".gz":
                with gzip.open(log_file, 'rt') as f:
                    entries = self._parse_log_file(f, filters)
            else:
                with open(log_file, 'r') as f:
                    entries = self._parse_log_file(f, filters)

            # Apply offset and limit
            return entries[offset:offset + limit]

        except Exception as e:
            logger.error(f"Failed to read log file {filename}: {e}")
            raise

    def _parse_log_file(self, file_handle, filters: Dict[str, any]) -> List[Dict[str, any]]:
        """Parse log file and apply filters"""
        entries = []

        for line in file_handle:
            line = line.strip()
            if not line:
                continue

            try:
                entry = json.loads(line)

                # Apply filters
                if self._matches_filters(entry, filters):
                    entries.append(entry)

            except json.JSONDecodeError:
                # Skip malformed JSON lines
                continue

        return entries

    def _matches_filters(self, entry: Dict[str, any], filters: Dict[str, any]) -> bool:
        """Check if log entry matches filters"""
        # Level filter
        if "level" in filters:
            if entry.get("level") != filters["level"].upper():
                return False

        # Agent filter
        if "agent_name" in filters:
            if entry.get("agent", {}).get("name") != filters["agent_name"]:
                return False

        # Correlation ID filter
        if "correlation_id" in filters:
            if entry.get("execution", {}).get("correlation_id") != filters["correlation_id"]:
                return False

        # Time range filter
        if "start_time" in filters:
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
            start_time = datetime.fromisoformat(filters["start_time"])
            if entry_time < start_time:
                return False

        if "end_time" in filters:
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(filters["end_time"])
            if entry_time > end_time:
                return False

        return True

    def export_logs(
        self,
        filename: str,
        output_format: str = "json",
        filters: Optional[Dict[str, any]] = None
    ) -> str:
        """
        Export logs to a specific format

        Args:
            filename: Name of log file to export
            output_format: Export format (json or csv)
            filters: Optional filters to apply

        Returns:
            Exported data as string
        """
        entries = self.read_log_entries(filename, limit=10000, filters=filters)

        if output_format == "json":
            return json.dumps(entries, indent=2)

        elif output_format == "csv":
            if not entries:
                return ""

            # CSV headers
            headers = ["timestamp", "level", "message", "agent_name", "correlation_id", "operation"]
            csv_lines = [",".join(headers)]

            # CSV rows
            for entry in entries:
                row = [
                    entry.get("timestamp", ""),
                    entry.get("level", ""),
                    entry.get("message", "").replace(",", ";"),  # Escape commas
                    entry.get("agent", {}).get("name", ""),
                    entry.get("execution", {}).get("correlation_id", ""),
                    entry.get("execution", {}).get("operation", "")
                ]
                csv_lines.append(",".join(row))

            return "\n".join(csv_lines)

        else:
            raise ValueError(f"Unsupported export format: {output_format}")


# Singleton instance
_log_rotation_service = None


def get_log_rotation_service() -> LogRotationService:
    """Get singleton log rotation service"""
    global _log_rotation_service
    if _log_rotation_service is None:
        _log_rotation_service = LogRotationService()
    return _log_rotation_service
