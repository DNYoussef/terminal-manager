"""
Metrics aggregation API endpoints
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db_setup import get_db
from app.services.metrics_aggregation import MetricsAggregationService
from app.models.metrics import CostRecommendation, PerformanceAlert

router = APIRouter(prefix="/metrics")


# ==================== Time-Series Aggregation ====================

@router.get("/aggregate/timeseries")
async def get_timeseries_aggregation(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    granularity: str = Query('day', regex='^(hour|day|week|month)$'),
    db: Session = Depends(get_db)
):
    """
    Get time-series aggregated metrics

    Granularity options: hour, day, week, month
    """
    service = MetricsAggregationService(db)

    # Parse dates
    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    else:
        start = datetime.utcnow() - timedelta(days=30)

    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    else:
        end = datetime.utcnow()

    try:
        aggregations = service.aggregate_by_time(start, end, granularity)
        return {
            'success': True,
            'period': {
                'start': start.isoformat(),
                'end': end.isoformat(),
                'granularity': granularity
            },
            'count': len(aggregations),
            'data': aggregations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Agent-Level Aggregation ====================

@router.get("/aggregate/by-agent/{agent_id}")
async def get_agent_aggregation(
    agent_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get aggregated metrics for specific agent
    """
    service = MetricsAggregationService(db)

    # Parse dates
    start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
    end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None

    try:
        aggregation = service.aggregate_by_agent(agent_id, start, end)
        return {
            'success': True,
            'data': aggregation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Role-Level Aggregation ====================

@router.get("/aggregate/by-role/{role}")
async def get_role_aggregation(
    role: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get aggregated metrics for all agents with specific role
    """
    service = MetricsAggregationService(db)

    start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
    end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None

    try:
        aggregation = service.aggregate_by_role(role, start, end)
        return {
            'success': True,
            'data': aggregation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Trend Detection ====================

@router.get("/trends/{metric_name}")
async def get_metric_trends(
    metric_name: str,
    agent_id: Optional[int] = Query(None),
    lookback_days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    Detect trends in specific metric

    Metric options: execution_time, cost, success_rate, quality_score
    """
    valid_metrics = ['execution_time', 'cost', 'success_rate', 'quality_score']
    if metric_name not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric_name. Must be one of: {', '.join(valid_metrics)}"
        )

    service = MetricsAggregationService(db)

    try:
        trend = service.detect_trends(metric_name, agent_id, lookback_days)
        return {
            'success': True,
            'data': trend
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Percentiles ====================

@router.get("/percentiles/{metric_name}")
async def get_metric_percentiles(
    metric_name: str,
    agent_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Calculate percentiles for specific metric

    Metric options: execution_time, cost, tokens, quality_score
    """
    valid_metrics = ['execution_time', 'cost', 'tokens', 'quality_score']
    if metric_name not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric_name. Must be one of: {', '.join(valid_metrics)}"
        )

    service = MetricsAggregationService(db)

    try:
        percentiles = service.calculate_percentiles(metric_name, agent_id)
        return {
            'success': True,
            'metric': metric_name,
            'agent_id': agent_id,
            'data': percentiles
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Outlier Detection ====================

@router.get("/outliers/{metric_name}")
async def get_metric_outliers(
    metric_name: str,
    z_threshold: float = Query(3.0, ge=1.0, le=5.0),
    db: Session = Depends(get_db)
):
    """
    Identify outliers using Z-score method

    Metric options: execution_time, cost
    """
    valid_metrics = ['execution_time', 'cost']
    if metric_name not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric_name. Must be one of: {', '.join(valid_metrics)}"
        )

    service = MetricsAggregationService(db)

    try:
        outliers = service.identify_outliers(metric_name, z_threshold)
        return {
            'success': True,
            'metric': metric_name,
            'z_threshold': z_threshold,
            'count': len(outliers),
            'data': outliers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Cost Optimization ====================

@router.get("/recommendations/cost")
async def get_cost_recommendations(
    db: Session = Depends(get_db)
):
    """
    Get cost optimization recommendations

    Analyzes budget usage patterns and suggests optimizations
    """
    service = MetricsAggregationService(db)

    try:
        recommendations = service.get_cost_recommendations()
        return {
            'success': True,
            'count': len(recommendations),
            'total_potential_savings': sum(r['estimated_savings'] for r in recommendations),
            'data': recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations/cost/stored")
async def get_stored_recommendations(
    status: Optional[str] = Query('pending', regex='^(pending|accepted|rejected|applied)$'),
    db: Session = Depends(get_db)
):
    """
    Get stored cost recommendations from database
    """
    try:
        query = db.query(CostRecommendation)

        if status:
            query = query.filter(CostRecommendation.status == status)

        recommendations = query.order_by(
            CostRecommendation.created_at.desc()
        ).limit(50).all()

        return {
            'success': True,
            'count': len(recommendations),
            'data': [
                {
                    'id': r.id,
                    'agent_name': r.agent_name,
                    'type': r.recommendation_type,
                    'priority': r.priority,
                    'current_budget': r.current_budget_usd,
                    'recommended_budget': r.recommended_budget_usd,
                    'estimated_savings': r.estimated_savings_usd,
                    'reason': r.reason,
                    'status': r.status,
                    'created_at': r.created_at.isoformat(),
                    'expires_at': r.expires_at.isoformat() if r.expires_at else None
                }
                for r in recommendations
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/recommendations/cost/{recommendation_id}/status")
async def update_recommendation_status(
    recommendation_id: int,
    status: str = Query(..., regex='^(accepted|rejected|applied)$'),
    db: Session = Depends(get_db)
):
    """
    Update recommendation status
    """
    try:
        recommendation = db.query(CostRecommendation).filter(
            CostRecommendation.id == recommendation_id
        ).first()

        if not recommendation:
            raise HTTPException(status_code=404, detail="Recommendation not found")

        recommendation.status = status
        if status == 'applied':
            recommendation.applied_at = datetime.utcnow()

        db.commit()

        return {
            'success': True,
            'message': f'Recommendation status updated to {status}'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Performance Insights ====================

@router.get("/insights/performance")
async def get_performance_insights(
    db: Session = Depends(get_db)
):
    """
    Get comprehensive performance insights

    Identifies patterns across all agents and operations
    """
    service = MetricsAggregationService(db)

    try:
        insights = service.get_performance_insights()
        return {
            'success': True,
            'data': insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Alerts ====================

@router.get("/alerts")
async def get_alerts(
    status: Optional[str] = Query('active', regex='^(active|acknowledged|resolved|ignored)$'),
    severity: Optional[str] = Query(None, regex='^(info|warning|error|critical)$'),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Get performance alerts
    """
    try:
        query = db.query(PerformanceAlert)

        if status:
            query = query.filter(PerformanceAlert.status == status)

        if severity:
            query = query.filter(PerformanceAlert.severity == severity)

        alerts = query.order_by(
            PerformanceAlert.detected_at.desc()
        ).limit(limit).all()

        return {
            'success': True,
            'count': len(alerts),
            'data': [
                {
                    'id': a.id,
                    'agent_name': a.agent_name,
                    'type': a.alert_type,
                    'severity': a.severity,
                    'metric': a.metric_name,
                    'current_value': a.current_value,
                    'expected_value': a.expected_value,
                    'threshold_value': a.threshold_value,
                    'deviation_percent': a.deviation_percent,
                    'message': a.message,
                    'status': a.status,
                    'detected_at': a.detected_at.isoformat(),
                    'acknowledged_at': a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                    'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None
                }
                for a in alerts
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert
    """
    try:
        alert = db.query(PerformanceAlert).filter(
            PerformanceAlert.id == alert_id
        ).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.status = 'acknowledged'
        alert.acknowledged_at = datetime.utcnow()

        db.commit()

        return {
            'success': True,
            'message': 'Alert acknowledged'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """
    Resolve an alert
    """
    try:
        alert = db.query(PerformanceAlert).filter(
            PerformanceAlert.id == alert_id
        ).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.status = 'resolved'
        alert.resolved_at = datetime.utcnow()

        db.commit()

        return {
            'success': True,
            'message': 'Alert resolved'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Statistics Summary ====================

@router.get("/summary")
async def get_metrics_summary(
    db: Session = Depends(get_db)
):
    """
    Get overall metrics summary dashboard
    """
    service = MetricsAggregationService(db)

    try:
        # Last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        today = datetime.utcnow()

        daily_metrics = service.aggregate_by_time(yesterday, today, 'day')

        # Last 30 days
        last_month = datetime.utcnow() - timedelta(days=30)
        monthly_metrics = service.aggregate_by_time(last_month, today, 'day')

        # Active alerts count
        active_alerts = db.query(PerformanceAlert).filter(
            PerformanceAlert.status == 'active'
        ).count()

        # Pending recommendations
        pending_recommendations = db.query(CostRecommendation).filter(
            CostRecommendation.status == 'pending'
        ).count()

        return {
            'success': True,
            'data': {
                'last_24h': daily_metrics[0] if daily_metrics else {},
                'last_30d_summary': {
                    'total_operations': sum(m['total_operations'] for m in monthly_metrics),
                    'total_cost_usd': sum(m['total_cost_usd'] for m in monthly_metrics),
                    'avg_success_rate': sum(m['success_rate'] for m in monthly_metrics) / len(monthly_metrics) if monthly_metrics else 0
                },
                'active_alerts': active_alerts,
                'pending_recommendations': pending_recommendations
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
