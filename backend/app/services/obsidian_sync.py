"""
Obsidian Integration for Memory MCP
Syncs scheduled tasks to Obsidian vault as markdown notes

Features:
- Task -> Markdown conversion with frontmatter
- Bidirectional sync (Obsidian <-> Memory MCP)
- Graph view relationships via tags
- Daily notes integration
- Memory layer visualization
"""
import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path


class ObsidianSyncService:
    """
    Service for syncing Memory MCP tasks with Obsidian vault

    Vault Structure:
    /Tasks/
      /Pending/
      /Completed/
      /Cancelled/
    /Memory/
      /Procedural/  - Execution states
      /Episodic/    - Task history
      /Semantic/    - Searchable content
    /Daily/         - Daily notes with task references
    """

    def __init__(self, vault_path: str):
        """
        Initialize Obsidian sync service

        Args:
            vault_path: Path to Obsidian vault root
        """
        self.vault_path = Path(vault_path)
        self.tasks_dir = self.vault_path / "Tasks"
        self.memory_dir = self.vault_path / "Memory"
        self.daily_dir = self.vault_path / "Daily"

        # Create directories if they don't exist
        self._ensure_directories()

    def _ensure_directories(self):
        """Create Obsidian vault directory structure"""
        directories = [
            self.tasks_dir / "Pending",
            self.tasks_dir / "Completed",
            self.tasks_dir / "Cancelled",
            self.memory_dir / "Procedural",
            self.memory_dir / "Episodic",
            self.memory_dir / "Semantic",
            self.daily_dir
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    def task_to_markdown(self, task_data: Dict[str, Any]) -> str:
        """
        Convert task to Obsidian markdown with YAML frontmatter

        Args:
            task_data: Task information

        Returns:
            Markdown content with frontmatter
        """
        # Build YAML frontmatter
        frontmatter = {
            "id": task_data["id"],
            "type": task_data["type"],
            "status": task_data["status"],
            "priority": task_data["priority"],
            "created": task_data.get("created_at", datetime.utcnow()).isoformat(),
            "updated": task_data.get("updated_at", datetime.utcnow()).isoformat(),
            "start": task_data["start"],
            "end": task_data["end"],
            "tags": task_data.get("tags", [])
        }

        # Build markdown content
        title = task_data["title"]
        description = task_data.get("description", "")
        task_type = task_data["type"]
        priority = task_data["priority"]
        status = task_data["status"]

        # Format tags for Obsidian
        tag_links = " ".join([f"#{tag}" for tag in task_data.get("tags", [])])

        # Build markdown
        markdown = f"""---
{self._yaml_dump(frontmatter)}
---

# {title}

## Details

- **Type**: {task_type.capitalize()}
- **Priority**: {self._priority_emoji(priority)} {priority.capitalize()}
- **Status**: {self._status_emoji(status)} {status.capitalize()}

## Schedule

- **Start**: {task_data['start']}
- **End**: {task_data['end']}
- **Duration**: {self._calculate_duration_str(task_data)}

## Description

{description if description else "*No description provided.*"}

## Tags

{tag_links if tag_links else "*No tags*"}

## Memory References

This task is stored in the Memory MCP Triple Layer System:

- **Procedural Layer**: [[Memory/Procedural/{task_data['id']}|Execution State]]
- **Episodic Layer**: [[Memory/Episodic/{task_data['id']}|Task History]]
- **Semantic Layer**: [[Memory/Semantic/{task_data['id']}|Searchable Content]]

---

*Created: {frontmatter['created']}*
*Last Updated: {frontmatter['updated']}*
"""

        return markdown.strip()

    def sync_task_to_obsidian(self, task_data: Dict[str, Any]) -> str:
        """
        Sync task to Obsidian vault

        Args:
            task_data: Task information

        Returns:
            Path to created note
        """
        # Determine subdirectory based on status
        status = task_data.get("status", "pending")
        status_dir = self.tasks_dir / status.capitalize()

        # Create note filename (sanitized title + ID)
        safe_title = self._sanitize_filename(task_data["title"])
        filename = f"{safe_title}_{task_data['id']}.md"
        note_path = status_dir / filename

        # Convert to markdown
        markdown = self.task_to_markdown(task_data)

        # Write to file
        note_path.write_text(markdown, encoding='utf-8')

        return str(note_path)

    def sync_memory_layers_to_obsidian(self, task_data: Dict[str, Any]):
        """
        Sync all three memory layers to Obsidian

        Creates separate notes for procedural, episodic, and semantic layers

        Args:
            task_data: Task information with memory references
        """
        task_id = task_data["id"]
        memory_refs = task_data.get("memory_refs", {})

        # Layer 1: Procedural
        if "procedural" in memory_refs:
            procedural_path = self.memory_dir / "Procedural" / f"{task_id}.md"
            procedural_content = self._build_procedural_note(task_data, memory_refs["procedural"])
            procedural_path.write_text(procedural_content, encoding='utf-8')

        # Layer 2: Episodic
        if "episodic" in memory_refs:
            episodic_path = self.memory_dir / "Episodic" / f"{task_id}.md"
            episodic_content = self._build_episodic_note(task_data, memory_refs["episodic"])
            episodic_path.write_text(episodic_content, encoding='utf-8')

        # Layer 3: Semantic
        if "semantic" in memory_refs:
            semantic_path = self.memory_dir / "Semantic" / f"{task_id}.md"
            semantic_content = self._build_semantic_note(task_data, memory_refs["semantic"])
            semantic_path.write_text(semantic_content, encoding='utf-8')

    def add_to_daily_note(self, task_data: Dict[str, Any]):
        """
        Add task reference to today's daily note

        Args:
            task_data: Task information
        """
        today = datetime.now().strftime("%Y-%m-%d")
        daily_note_path = self.daily_dir / f"{today}.md"

        # Read existing content or create new
        if daily_note_path.exists():
            content = daily_note_path.read_text(encoding='utf-8')
        else:
            content = f"# {today}\n\n## Tasks\n\n"

        # Add task reference
        task_ref = f"- [[Tasks/{task_data['status'].capitalize()}/{self._sanitize_filename(task_data['title'])}_{task_data['id']}|{task_data['title']}]] - {task_data['type']} ({task_data['priority']})\n"

        if "## Tasks" not in content:
            content += "\n## Tasks\n\n"

        content += task_ref

        daily_note_path.write_text(content, encoding='utf-8')

    def parse_obsidian_task(self, note_path: Path) -> Optional[Dict[str, Any]]:
        """
        Parse Obsidian markdown note back to task data

        Args:
            note_path: Path to Obsidian note

        Returns:
            Task data dict or None if invalid
        """
        if not note_path.exists():
            return None

        content = note_path.read_text(encoding='utf-8')

        # Extract YAML frontmatter
        frontmatter = self._extract_frontmatter(content)
        if not frontmatter:
            return None

        return frontmatter

    def watch_vault_changes(self) -> List[Dict[str, Any]]:
        """
        Watch Obsidian vault for task modifications

        Returns:
            List of modified tasks
        """
        modified_tasks = []

        # Check all task notes
        for status_dir in ["Pending", "Completed", "Cancelled"]:
            status_path = self.tasks_dir / status_dir
            if not status_path.exists():
                continue

            for note_path in status_path.glob("*.md"):
                # Check if modified since last sync
                task_data = self.parse_obsidian_task(note_path)
                if task_data:
                    modified_tasks.append(task_data)

        return modified_tasks

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _build_procedural_note(self, task_data: Dict[str, Any], memory_ref: Dict[str, Any]) -> str:
        """Build procedural layer note"""
        return f"""---
layer: procedural
task_id: {task_data['id']}
type: execution-state
---

# Procedural Layer: {task_data['title']}

## Execution State

```json
{json.dumps(json.loads(memory_ref['content']), indent=2)}
```

## Metadata

{self._format_metadata(memory_ref['metadata'])}

---

Back to: [[Tasks/{task_data['status'].capitalize()}/{self._sanitize_filename(task_data['title'])}_{task_data['id']}|Task Note]]
"""

    def _build_episodic_note(self, task_data: Dict[str, Any], memory_ref: Dict[str, Any]) -> str:
        """Build episodic layer note"""
        return f"""---
layer: episodic
task_id: {task_data['id']}
type: task-history
---

# Episodic Layer: {task_data['title']}

## Task History

```json
{json.dumps(json.loads(memory_ref['content']), indent=2)}
```

## Timeline

- **Created**: {task_data.get('created_at')}
- **Last Updated**: {task_data.get('updated_at')}

---

Back to: [[Tasks/{task_data['status'].capitalize()}/{self._sanitize_filename(task_data['title'])}_{task_data['id']}|Task Note]]
"""

    def _build_semantic_note(self, task_data: Dict[str, Any], memory_ref: Dict[str, Any]) -> str:
        """Build semantic layer note"""
        return f"""---
layer: semantic
task_id: {task_data['id']}
type: searchable-content
---

# Semantic Layer: {task_data['title']}

## Natural Language Representation

{memory_ref['content']}

## Graph Connections

### Related Tasks
- Use tags to discover related tasks
- Tags: {", ".join([f"#{tag}" for tag in task_data.get('tags', [])])}

### Memory Layers
- [[Memory/Procedural/{task_data['id']}|Procedural]]
- [[Memory/Episodic/{task_data['id']}|Episodic]]

---

Back to: [[Tasks/{task_data['status'].capitalize()}/{self._sanitize_filename(task_data['title'])}_{task_data['id']}|Task Note]]
"""

    def _yaml_dump(self, data: Dict[str, Any]) -> str:
        """Convert dict to YAML string"""
        lines = []
        for key, value in data.items():
            if isinstance(value, list):
                lines.append(f"{key}:")
                for item in value:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"{key}: {value}")
        return "\n".join(lines)

    def _extract_frontmatter(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract YAML frontmatter from markdown"""
        if not content.startswith("---"):
            return None

        parts = content.split("---", 2)
        if len(parts) < 3:
            return None

        # Parse YAML (simple parsing, not full YAML)
        frontmatter = {}
        for line in parts[1].strip().split("\n"):
            if ":" in line:
                key, value = line.split(":", 1)
                frontmatter[key.strip()] = value.strip()

        return frontmatter

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for filesystem"""
        # Remove invalid characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '')
        return filename[:100]  # Limit length

    def _priority_emoji(self, priority: str) -> str:
        """Get emoji for priority level"""
        emojis = {
            "low": "🟢",
            "medium": "🟡",
            "high": "🔴"
        }
        return emojis.get(priority, "⚪")

    def _status_emoji(self, status: str) -> str:
        """Get emoji for status"""
        emojis = {
            "pending": "⏳",
            "completed": "✅",
            "cancelled": "❌"
        }
        return emojis.get(status, "⚪")

    def _calculate_duration_str(self, task_data: Dict[str, Any]) -> str:
        """Calculate and format task duration"""
        try:
            start = datetime.fromisoformat(str(task_data.get("start", "")))
            end = datetime.fromisoformat(str(task_data.get("end", "")))
            duration = (end - start).total_seconds() / 60

            if duration < 60:
                return f"{int(duration)} minutes"
            elif duration < 1440:
                hours = duration / 60
                return f"{hours:.1f} hours"
            else:
                days = duration / 1440
                return f"{days:.1f} days"
        except (ValueError, TypeError):
            return "Unknown"

    def _format_metadata(self, metadata: Dict[str, Any]) -> str:
        """Format metadata for display"""
        lines = []
        for key, value in metadata.items():
            lines.append(f"- **{key}**: {value}")
        return "\n".join(lines)
