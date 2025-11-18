"""
Search API Router - Global search with PostgreSQL full-text search
Supports searching across tasks, projects, and agents with fuzzy matching
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String
from typing import List, Dict, Any
from app.database import get_db
from app.models import Task, Project, Agent

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("", response_model=Dict[str, Any])
async def search(
    q: str = Query(..., min_length=2, description="Search query (minimum 2 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results per type"),
    db: Session = Depends(get_db)
):
    """
    Global search endpoint with PostgreSQL full-text search

    Searches across:
    - Tasks: name, description, skill_name
    - Projects: name, description
    - Agents: name, type, capabilities

    Args:
        q: Search query string
        limit: Maximum results to return per type
        db: Database session

    Returns:
        {
            "query": "search term",
            "results": [
                {
                    "id": "uuid",
                    "type": "task|project|agent",
                    "title": "Item name",
                    "description": "Item description",
                    "metadata": {...},
                    "score": 0.85
                }
            ],
            "total": 42
        }
    """
    search_term = f"%{q.lower()}%"
    results = []

    # Search Tasks
    task_results = (
        db.query(Task)
        .filter(
            or_(
                func.lower(Task.name).like(search_term),
                func.lower(Task.description).like(search_term),
                func.lower(Task.skill_name).like(search_term)
            )
        )
        .limit(limit)
        .all()
    )

    for task in task_results:
        # Calculate relevance score (simple implementation)
        score = calculate_score(q, task.name, task.description)
        results.append({
            "id": str(task.id),
            "type": "task",
            "title": task.name,
            "description": task.description,
            "metadata": {
                "skill_name": task.skill_name,
                "status": task.status,
                "priority": task.priority,
                "estimated_hours": task.estimated_hours
            },
            "score": score
        })

    # Search Projects
    project_results = (
        db.query(Project)
        .filter(
            or_(
                func.lower(Project.name).like(search_term),
                func.lower(Project.description).like(search_term)
            )
        )
        .limit(limit)
        .all()
    )

    for project in project_results:
        score = calculate_score(q, project.name, project.description)
        results.append({
            "id": str(project.id),
            "type": "project",
            "title": project.name,
            "description": project.description,
            "metadata": {
                "status": project.status,
                "created_at": project.created_at.isoformat() if project.created_at else None
            },
            "score": score
        })

    # Search Agents
    agent_results = (
        db.query(Agent)
        .filter(
            or_(
                func.lower(Agent.name).like(search_term),
                func.lower(Agent.type).like(search_term),
                func.lower(cast(Agent.capabilities, String)).like(search_term)
            )
        )
        .limit(limit)
        .all()
    )

    for agent in agent_results:
        score = calculate_score(q, agent.name, agent.type)
        results.append({
            "id": str(agent.id),
            "type": "agent",
            "title": agent.name,
            "description": f"{agent.type} agent",
            "metadata": {
                "agent_type": agent.type,
                "capabilities": agent.capabilities,
                "status": agent.status
            },
            "score": score
        })

    # Sort results by score (highest first)
    results.sort(key=lambda x: x["score"], reverse=True)

    # Limit total results to top 10
    top_results = results[:10]

    return {
        "query": q,
        "results": top_results,
        "total": len(results)
    }


def calculate_score(query: str, title: str, description: str = "") -> float:
    """
    Calculate relevance score for search result

    Scoring factors:
    - Exact match in title: 1.0
    - Title contains query: 0.8
    - Description contains query: 0.5
    - Partial match: 0.3

    Args:
        query: Search query
        title: Item title/name
        description: Item description

    Returns:
        Relevance score (0.0 - 1.0)
    """
    query_lower = query.lower()
    title_lower = title.lower()
    description_lower = description.lower() if description else ""

    # Exact title match
    if query_lower == title_lower:
        return 1.0

    # Title starts with query
    if title_lower.startswith(query_lower):
        return 0.9

    # Title contains query
    if query_lower in title_lower:
        return 0.8

    # Description contains query
    if description and query_lower in description_lower:
        return 0.5

    # Partial word match
    query_words = query_lower.split()
    title_words = title_lower.split()

    matches = sum(1 for qw in query_words if any(qw in tw for tw in title_words))
    if matches > 0:
        return 0.3 + (matches / len(query_words)) * 0.2

    return 0.1


@router.get("/suggestions", response_model=List[str])
async def search_suggestions(
    q: str = Query(..., min_length=1, description="Query prefix"),
    limit: int = Query(5, ge=1, le=10, description="Maximum suggestions"),
    db: Session = Depends(get_db)
):
    """
    Get search suggestions/autocomplete for query prefix

    Returns popular or recent search terms that match the prefix
    """
    search_term = f"{q.lower()}%"
    suggestions = []

    # Get task names
    tasks = (
        db.query(Task.name)
        .filter(func.lower(Task.name).like(search_term))
        .distinct()
        .limit(limit)
        .all()
    )
    suggestions.extend([t[0] for t in tasks])

    # Get project names
    if len(suggestions) < limit:
        projects = (
            db.query(Project.name)
            .filter(func.lower(Project.name).like(search_term))
            .distinct()
            .limit(limit - len(suggestions))
            .all()
        )
        suggestions.extend([p[0] for p in projects])

    return suggestions[:limit]


# Alternative: PostgreSQL Full-Text Search with tsvector (commented out for now)
"""
For better performance with large datasets, use PostgreSQL full-text search:

1. Add tsvector column to models:
   search_vector = Column(TSVECTOR)

2. Create GIN index:
   CREATE INDEX tasks_search_idx ON tasks USING GIN(search_vector);

3. Update search_vector on insert/update:
   CREATE TRIGGER tasks_search_vector_update
   BEFORE INSERT OR UPDATE ON tasks
   FOR EACH ROW EXECUTE FUNCTION
   tsvector_update_trigger(search_vector, 'pg_catalog.english', name, description, skill_name);

4. Query with ts_rank:
   query = "SELECT *, ts_rank(search_vector, plainto_tsquery('english', :query)) as rank
            FROM tasks
            WHERE search_vector @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC"
"""
