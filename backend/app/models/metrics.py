"""
Metrics models for agent performance tracking
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class AgentMetric(Base):
    """Agent performance metrics"""
    __tablename__ = "agent_metrics"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String(255), nullable=False, index=True)
    agent_role = Column(String(100), index=True)
    agent_category = Column(String(100), index=True)

    # Operation details
    operation_type = Column(String(100), nullable=False, index=True)
    operation_name = Column(String(255))

    # Performance metrics
    execution_time_ms = Column(Float)
    tokens_used = Column(Integer)
    api_calls = Column(Integer, default=1)
    success = Column(Integer, default=1)  # 1 = success, 0 = failure
    quality_score = Column(Float)  # 0-100

    # Cost tracking
    cost_usd = Column(Float)

    # Additional metadata
    extra_data = Column(JSON)

    # Timestamps
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_agent_timestamp', 'agent_id', 'timestamp'),
        Index('idx_role_timestamp', 'agent_role', 'timestamp'),
        Index('idx_operation_timestamp', 'operation_type', 'timestamp'),
        Index('idx_category_timestamp', 'agent_category', 'timestamp'),
    )


class BudgetAllocation(Base):
    """Agent budget allocations and tracking"""
    __tablename__ = "budget_allocations"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), unique=True)
    agent_name = Column(String(255), nullable=False, index=True)
    agent_role = Column(String(100), index=True)

    # Budget details
    total_budget_usd = Column(Float, nullable=False)
    used_budget_usd = Column(Float, default=0.0)
    remaining_budget_usd = Column(Float)
    utilization_percent = Column(Float)  # 0-100

    # Thresholds
    warning_threshold_percent = Column(Float, default=80.0)
    critical_threshold_percent = Column(Float, default=95.0)

    # Status
    status = Column(String(50), default='active')  # active, warning, critical, paused

    # Timestamps
    last_used_at = Column(DateTime)
    reset_at = Column(DateTime)  # When budget was last reset
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_budget_status', 'status'),
        Index('idx_budget_utilization', 'utilization_percent'),
    )


class MetricsAggregation(Base):
    """Pre-calculated metrics aggregations for performance"""
    __tablename__ = "metrics_aggregations"

    id = Column(Integer, primary_key=True, index=True)

    # Aggregation metadata
    aggregation_type = Column(String(50), nullable=False, index=True)  # timeseries, agent, role, category
    granularity = Column(String(20))  # hour, day, week, month
    dimension_key = Column(String(255))  # agent_id, role, category, etc.
    dimension_value = Column(String(255))

    # Time range
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)

    # Aggregated metrics
    total_operations = Column(Integer, default=0)
    successful_operations = Column(Integer, default=0)
    failed_operations = Column(Integer, default=0)
    success_rate = Column(Float)  # 0-100

    total_execution_time_ms = Column(Float, default=0.0)
    avg_execution_time_ms = Column(Float)
    median_execution_time_ms = Column(Float)
    p95_execution_time_ms = Column(Float)

    total_tokens = Column(Integer, default=0)
    avg_tokens = Column(Float)

    total_cost_usd = Column(Float, default=0.0)
    avg_cost_usd = Column(Float)

    avg_quality_score = Column(Float)

    # Additional statistics
    stats_json = Column(JSON)  # Percentiles, std dev, etc.

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_agg_type_period', 'aggregation_type', 'period_start', 'period_end'),
        Index('idx_agg_dimension', 'dimension_key', 'dimension_value'),
    )


class CostRecommendation(Base):
    """Cost optimization recommendations"""
    __tablename__ = "cost_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"))
    agent_name = Column(String(255), index=True)

    # Recommendation details
    recommendation_type = Column(String(50), nullable=False, index=True)  # reduce_budget, increase_budget, pause, optimize
    priority = Column(String(20), default='medium')  # low, medium, high, critical

    current_budget_usd = Column(Float)
    recommended_budget_usd = Column(Float)
    estimated_savings_usd = Column(Float)

    reason = Column(String(500))
    details_json = Column(JSON)

    # Status
    status = Column(String(50), default='pending')  # pending, accepted, rejected, applied
    applied_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Recommendations expire after 7 days

    __table_args__ = (
        Index('idx_recommendation_status', 'status'),
        Index('idx_recommendation_priority', 'priority'),
    )


class PerformanceAlert(Base):
    """Performance alerts and anomalies"""
    __tablename__ = "performance_alerts"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"))
    agent_name = Column(String(255), index=True)

    # Alert details
    alert_type = Column(String(50), nullable=False, index=True)  # budget_overrun, performance_degradation, outlier, anomaly
    severity = Column(String(20), default='warning')  # info, warning, error, critical

    metric_name = Column(String(100))
    current_value = Column(Float)
    expected_value = Column(Float)
    threshold_value = Column(Float)
    deviation_percent = Column(Float)

    message = Column(String(500))
    details_json = Column(JSON)

    # Status
    status = Column(String(50), default='active')  # active, acknowledged, resolved, ignored
    acknowledged_at = Column(DateTime)
    resolved_at = Column(DateTime)

    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_alert_severity_status', 'severity', 'status'),
        Index('idx_alert_type_status', 'alert_type', 'status'),
    )
