"""
Event Persistence Service
Handles dual persistence (memory + database) for events with context preservation
"""
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_

from app.models.stored_event import StoredEvent
from app.models.session import Session as SessionModel
from app.models.budget_history import BudgetHistory


class EventPersistenceService:
    """
    Service for persisting events to database with full WHO/WHEN/PROJECT/WHY metadata
    """

    @staticmethod
    def store_event(db: Session, event_data: Dict[str, Any]) -> StoredEvent:
        """
        Store a single event to database with full context preservation

        Args:
            db: Database session
            event_data: Event payload from hooks/visibility pipeline

        Returns:
            StoredEvent model instance
        """
        # Extract metadata from event
        metadata = event_data.get('metadata', {})
        tagged_metadata = metadata.get('tagged_metadata', {})

        # Generate unique ID
        event_id = str(uuid.uuid4())

        # Extract timestamp
        timestamp_str = event_data.get('timestamp')
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00')) if timestamp_str else datetime.utcnow()

        # Create stored event
        stored_event = StoredEvent(
            id=event_id,
            event_id=event_data.get('event_id', event_id),
            batch_id=event_data.get('batch_id'),

            # Event classification
            event_type=event_data.get('event_type', 'unknown'),
            operation=event_data.get('operation'),
            status=event_data.get('status', 'success'),

            # WHO metadata
            agent_id=event_data.get('agent_id', 'unknown'),
            agent_name=event_data.get('agent_name'),
            agent_type=tagged_metadata.get('_agent'),
            agent_role=event_data.get('agent_role'),
            agent_category=tagged_metadata.get('_agent_category'),

            # WHEN metadata
            timestamp=timestamp,
            timestamp_iso=tagged_metadata.get('_timestamp_iso') or timestamp_str,
            timestamp_unix=tagged_metadata.get('_timestamp_unix'),

            # PROJECT metadata
            project=tagged_metadata.get('_project') or metadata.get('project'),
            session_id=metadata.get('session_id'),

            # WHY metadata
            intent=tagged_metadata.get('_intent'),
            description=tagged_metadata.get('_description') or metadata.get('description'),

            # Correlation
            trace_id=metadata.get('trace_id'),
            span_id=metadata.get('span_id'),
            parent_trace_id=metadata.get('parent_trace_id'),

            # Task/operation context
            task_id=metadata.get('task_id'),
            file_path=metadata.get('file_path'),

            # Metrics
            duration=metadata.get('duration'),
            tokens_used=metadata.get('tokens_used'),
            cost=metadata.get('cost'),
            lines_changed=metadata.get('lines_changed'),
            bytes_changed=metadata.get('bytes_changed'),
            files_modified=len(metadata.get('filesModified', [])) if 'filesModified' in metadata else None,
            commands_executed=metadata.get('commandsExecuted'),

            # Full payload
            metadata=tagged_metadata,
            raw_payload=event_data,

            # Audit
            created_at=datetime.utcnow(),
            indexed_at=datetime.utcnow()
        )

        db.add(stored_event)
        db.commit()
        db.refresh(stored_event)

        return stored_event

    @staticmethod
    def store_batch(db: Session, batch_data: Dict[str, Any]) -> List[StoredEvent]:
        """
        Store a batch of events to database

        Args:
            db: Database session
            batch_data: EventBatch payload with events array

        Returns:
            List of StoredEvent instances
        """
        events = batch_data.get('events', [])
        batch_id = batch_data.get('batch_id')

        stored_events = []
        for event in events:
            # Add batch_id to each event
            if batch_id and 'batch_id' not in event:
                event['batch_id'] = batch_id

            stored_event = EventPersistenceService.store_event(db, event)
            stored_events.append(stored_event)

        return stored_events

    @staticmethod
    def query_events(
        db: Session,
        agent_id: Optional[str] = None,
        project: Optional[str] = None,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        event_type: Optional[str] = None,
        intent: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[StoredEvent]:
        """
        Query events with filters

        Args:
            db: Database session
            agent_id: Filter by agent ID
            project: Filter by project
            session_id: Filter by session ID
            trace_id: Filter by trace ID
            event_type: Filter by event type
            intent: Filter by intent
            start_time: Filter by start timestamp
            end_time: Filter by end timestamp
            limit: Maximum number of results
            offset: Offset for pagination

        Returns:
            List of StoredEvent instances
        """
        query = db.query(StoredEvent)

        # Apply filters
        if agent_id:
            query = query.filter(StoredEvent.agent_id == agent_id)
        if project:
            query = query.filter(StoredEvent.project == project)
        if session_id:
            query = query.filter(StoredEvent.session_id == session_id)
        if trace_id:
            query = query.filter(StoredEvent.trace_id == trace_id)
        if event_type:
            query = query.filter(StoredEvent.event_type == event_type)
        if intent:
            query = query.filter(StoredEvent.intent == intent)
        if start_time:
            query = query.filter(StoredEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(StoredEvent.timestamp <= end_time)

        # Order by timestamp descending (most recent first)
        query = query.order_by(desc(StoredEvent.timestamp))

        # Apply pagination
        query = query.limit(limit).offset(offset)

        return query.all()

    @staticmethod
    def get_session_summary(db: Session, session_id: str) -> Optional[SessionModel]:
        """
        Get session summary from database

        Args:
            db: Database session
            session_id: Session identifier

        Returns:
            Session model instance or None
        """
        return db.query(SessionModel).filter(SessionModel.session_id == session_id).first()

    @staticmethod
    def update_session_metrics(db: Session, session_id: str, event_data: Dict[str, Any]):
        """
        Update session metrics based on new event

        Args:
            db: Database session
            session_id: Session identifier
            event_data: Event data to aggregate
        """
        session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()

        if not session:
            # Create new session
            session = SessionModel(
                id=str(uuid.uuid4()),
                session_id=session_id,
                project=event_data.get('metadata', {}).get('tagged_metadata', {}).get('_project'),
                started_at=datetime.utcnow(),
                status='active'
            )
            db.add(session)

        # Update metrics based on event type
        event_type = event_data.get('event_type', '')
        metadata = event_data.get('metadata', {})

        if 'task-completed' in event_type or 'task' in event_type:
            session.total_tasks += 1
            if event_data.get('status') == 'success':
                session.successful_tasks += 1
            else:
                session.failed_tasks += 1

        if 'file-edited' in event_type or 'edit' in event_type:
            session.total_edits += 1
            session.total_lines_changed += metadata.get('lines_changed', 0)
            session.total_bytes_changed += metadata.get('bytes_changed', 0)

        # Track tokens/cost
        session.total_tokens_used += metadata.get('tokens_used', 0)
        session.total_cost += metadata.get('cost', 0.0)

        # Update agent tracking
        agent_id = event_data.get('agent_id')
        if agent_id:
            agents_used = session.agents_used or []
            if agent_id not in agents_used:
                agents_used.append(agent_id)
                session.agents_used = agents_used

        session.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(session)

        return session

    @staticmethod
    def store_budget_history(
        db: Session,
        agent_id: str,
        operation_type: str,
        tokens_used: int,
        cost: float,
        budget_before: Dict[str, Any],
        budget_after: Dict[str, Any],
        blocked: bool = False,
        block_reason: Optional[str] = None,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None
    ) -> BudgetHistory:
        """
        Store budget history entry

        Args:
            db: Database session
            agent_id: Agent identifier
            operation_type: Type of operation
            tokens_used: Tokens consumed
            cost: Cost in USD
            budget_before: Budget state before operation
            budget_after: Budget state after operation
            blocked: Whether operation was blocked
            block_reason: Reason for blocking
            session_id: Session identifier
            trace_id: Trace identifier

        Returns:
            BudgetHistory instance
        """
        history_id = str(uuid.uuid4())

        budget_history = BudgetHistory(
            id=history_id,
            history_id=history_id,
            agent_id=agent_id,
            operation_type=operation_type,
            session_id=session_id,
            trace_id=trace_id,
            timestamp=datetime.utcnow(),
            period='daily',  # Default to daily tracking
            budget_before=budget_before,
            tokens_remaining_before=budget_before.get('remaining', {}).get('agent'),
            cost_remaining_before=budget_before.get('remaining', {}).get('cost'),
            tokens_used=tokens_used,
            cost=cost,
            budget_after=budget_after,
            tokens_remaining_after=budget_after.get('remaining', {}).get('agent'),
            cost_remaining_after=budget_after.get('remaining', {}).get('cost'),
            tokens_per_hour_limit=budget_before.get('limits', {}).get('tokensPerHour'),
            tokens_per_day_limit=budget_before.get('limits', {}).get('tokensPerDay'),
            max_cost_per_operation_limit=budget_before.get('limits', {}).get('maxCostPerOperation'),
            blocked=1 if blocked else 0,
            block_reason=block_reason
        )

        db.add(budget_history)
        db.commit()
        db.refresh(budget_history)

        return budget_history
