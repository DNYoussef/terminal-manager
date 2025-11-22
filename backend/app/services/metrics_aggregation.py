"""
Comprehensive metrics aggregation service for agent performance analytics
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import func, and_, or_, case, desc, asc
from sqlalchemy.orm import Session
import numpy as np
from scipy import stats

from app.models.metrics import (
    AgentMetric,
    BudgetAllocation,
    MetricsAggregation,
    CostRecommendation,
    PerformanceAlert
)
from app.services.cache import cached, invalidate_cache_pattern


class MetricsAggregationService:
    """Advanced metrics aggregation with cost optimization and performance insights"""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Time-Series Aggregation ====================

    @cached(ttl=300, key_prefix="metrics:timeseries")
    def aggregate_by_time(
        self,
        start_date: datetime,
        end_date: datetime,
        granularity: str = 'day'
    ) -> List[Dict[str, Any]]:
        """
        Aggregate metrics by time intervals

        Args:
            start_date: Start of time range
            end_date: End of time range
            granularity: 'hour', 'day', 'week', or 'month'

        Returns:
            List of aggregated metrics per time bucket
        """
        # Bucket timestamps in Python to avoid database-specific date functions
        def truncate_timestamp(ts: datetime) -> datetime:
            if granularity == 'hour':
                return ts.replace(minute=0, second=0, microsecond=0)
            if granularity == 'day':
                return ts.replace(hour=0, minute=0, second=0, microsecond=0)
            if granularity == 'week':
                start_of_week = ts - timedelta(days=ts.weekday())
                return start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
            if granularity == 'month':
                return ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            raise ValueError(f"Invalid granularity: {granularity}")

        metrics = self.db.query(AgentMetric).filter(
            and_(
                AgentMetric.timestamp >= start_date,
                AgentMetric.timestamp <= end_date
            )
        ).all()

        buckets: Dict[datetime, Dict[str, Any]] = {}
        for metric in metrics:
            bucket = truncate_timestamp(metric.timestamp)
            bucket_data = buckets.setdefault(bucket, {
                'total_operations': 0,
                'successful_operations': 0,
                'failed_operations': 0,
                'execution_times': [],
                'total_tokens': 0,
                'total_cost_usd': 0.0,
                'quality_scores': []
            })

            bucket_data['total_operations'] += 1
            if metric.success == 1:
                bucket_data['successful_operations'] += 1
            else:
                bucket_data['failed_operations'] += 1

            if metric.execution_time_ms is not None:
                bucket_data['execution_times'].append(metric.execution_time_ms)
            if metric.tokens_used is not None:
                bucket_data['total_tokens'] += metric.tokens_used
            if metric.cost_usd is not None:
                bucket_data['total_cost_usd'] += metric.cost_usd
            if metric.quality_score is not None:
                bucket_data['quality_scores'].append(metric.quality_score)

        aggregations = []
        for period, data in sorted(buckets.items(), key=lambda item: item[0]):
            success_rate = (data['successful_operations'] / data['total_operations'] * 100)
            avg_execution_time = np.mean(data['execution_times']) if data['execution_times'] else 0
            avg_quality = np.mean(data['quality_scores']) if data['quality_scores'] else 0

            aggregations.append({
                'timestamp': period.isoformat(),
                'total_operations': data['total_operations'],
                'successful_operations': data['successful_operations'],
                'failed_operations': data['failed_operations'],
                'success_rate': round(success_rate, 2),
                'avg_execution_time_ms': round(avg_execution_time, 2),
                'total_tokens': data['total_tokens'],
                'total_cost_usd': round(data['total_cost_usd'], 4),
                'avg_quality_score': round(avg_quality, 2)
            })

        return aggregations

    # ==================== Agent-Level Aggregation ====================

    @cached(ttl=300, key_prefix="metrics:agent")
    def aggregate_by_agent(
        self,
        agent_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Aggregate metrics for specific agent

        Returns agent-specific performance summary
        """
        # Default to last 30 days
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Query metrics
        metrics = self.db.query(AgentMetric).filter(
            and_(
                AgentMetric.agent_id == agent_id,
                AgentMetric.timestamp >= start_date,
                AgentMetric.timestamp <= end_date
            )
        ).all()

        if not metrics:
            return {
                'agent_id': agent_id,
                'total_tasks': 0,
                'message': 'No metrics found for this agent'
            }

        # Calculate statistics
        total_tasks = len(metrics)
        successful_tasks = sum(1 for m in metrics if m.success == 1)
        failed_tasks = total_tasks - successful_tasks
        success_rate = (successful_tasks / total_tasks) * 100 if total_tasks > 0 else 0

        execution_times = [m.execution_time_ms for m in metrics if m.execution_time_ms]
        total_tokens = sum(m.tokens_used for m in metrics if m.tokens_used)
        total_cost = sum(m.cost_usd for m in metrics if m.cost_usd)
        quality_scores = [m.quality_score for m in metrics if m.quality_score]

        # Get budget info
        budget = self.db.query(BudgetAllocation).filter(
            BudgetAllocation.agent_id == agent_id
        ).first()

        return {
            'agent_id': agent_id,
            'agent_name': metrics[0].agent_name if metrics else 'Unknown',
            'agent_role': metrics[0].agent_role if metrics else 'Unknown',
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'tasks': {
                'total': total_tasks,
                'successful': successful_tasks,
                'failed': failed_tasks,
                'success_rate': round(success_rate, 2)
            },
            'performance': {
                'avg_execution_time_ms': round(np.mean(execution_times), 2) if execution_times else 0,
                'median_execution_time_ms': round(np.median(execution_times), 2) if execution_times else 0,
                'p95_execution_time_ms': round(np.percentile(execution_times, 95), 2) if execution_times else 0,
                'total_tokens': total_tokens,
                'avg_tokens_per_task': round(total_tokens / total_tasks, 2) if total_tasks > 0 else 0
            },
            'cost': {
                'total_usd': round(total_cost, 4),
                'avg_per_task_usd': round(total_cost / total_tasks, 4) if total_tasks > 0 else 0,
                'budget_allocated_usd': budget.total_budget_usd if budget else 0,
                'budget_remaining_usd': budget.remaining_budget_usd if budget else 0,
                'budget_utilization_percent': budget.utilization_percent if budget else 0
            },
            'quality': {
                'avg_score': round(np.mean(quality_scores), 2) if quality_scores else 0,
                'median_score': round(np.median(quality_scores), 2) if quality_scores else 0,
                'min_score': round(min(quality_scores), 2) if quality_scores else 0,
                'max_score': round(max(quality_scores), 2) if quality_scores else 0
            }
        }

    # ==================== Role-Level Aggregation ====================

    @cached(ttl=300, key_prefix="metrics:role")
    def aggregate_by_role(
        self,
        role: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Aggregate metrics for all agents with specific role

        Compare performance across agents in same role
        """
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Query by role
        results = self.db.query(
            AgentMetric.agent_name,
            func.count(AgentMetric.id).label('total_tasks'),
            func.sum(case((AgentMetric.success == 1, 1), else_=0)).label('successful_tasks'),
            func.avg(AgentMetric.execution_time_ms).label('avg_execution_time_ms'),
            func.sum(AgentMetric.cost_usd).label('total_cost_usd'),
            func.avg(AgentMetric.quality_score).label('avg_quality_score')
        ).filter(
            and_(
                AgentMetric.agent_role == role,
                AgentMetric.timestamp >= start_date,
                AgentMetric.timestamp <= end_date
            )
        ).group_by(AgentMetric.agent_name).all()

        agents_data = []
        for row in results:
            success_rate = (row.successful_tasks / row.total_tasks * 100) if row.total_tasks > 0 else 0
            agents_data.append({
                'agent_name': row.agent_name,
                'total_tasks': row.total_tasks,
                'success_rate': round(success_rate, 2),
                'avg_execution_time_ms': round(row.avg_execution_time_ms or 0, 2),
                'total_cost_usd': round(row.total_cost_usd or 0, 4),
                'avg_quality_score': round(row.avg_quality_score or 0, 2)
            })

        # Overall role statistics
        total_tasks_all = sum(a['total_tasks'] for a in agents_data)
        total_cost_all = sum(a['total_cost_usd'] for a in agents_data)

        return {
            'role': role,
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'summary': {
                'total_agents': len(agents_data),
                'total_tasks': total_tasks_all,
                'total_cost_usd': round(total_cost_all, 4),
                'avg_cost_per_agent': round(total_cost_all / len(agents_data), 4) if agents_data else 0
            },
            'agents': sorted(agents_data, key=lambda x: x['total_tasks'], reverse=True)
        }

    # ==================== Trend Detection ====================

    def detect_trends(
        self,
        metric_name: str,
        agent_id: Optional[int] = None,
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """
        Detect trends using linear regression

        Returns trend direction and slope
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=lookback_days)

        # Build query
        query = self.db.query(
            func.date_trunc('day', AgentMetric.timestamp).label('day')
        )

        # Select metric
        if metric_name == 'execution_time':
            query = query.add_columns(func.avg(AgentMetric.execution_time_ms).label('value'))
        elif metric_name == 'cost':
            query = query.add_columns(func.sum(AgentMetric.cost_usd).label('value'))
        elif metric_name == 'success_rate':
            total = func.count(AgentMetric.id)
            successful = func.sum(case((AgentMetric.success == 1, 1), else_=0))
            query = query.add_columns((successful * 100.0 / total).label('value'))
        elif metric_name == 'quality_score':
            query = query.add_columns(func.avg(AgentMetric.quality_score).label('value'))
        else:
            raise ValueError(f"Invalid metric_name: {metric_name}")

        # Apply filters
        query = query.filter(
            and_(
                AgentMetric.timestamp >= start_date,
                AgentMetric.timestamp <= end_date
            )
        )

        if agent_id:
            query = query.filter(AgentMetric.agent_id == agent_id)

        # Group and order
        results = query.group_by('day').order_by('day').all()

        if len(results) < 2:
            return {
                'metric': metric_name,
                'trend': 'insufficient_data',
                'data_points': len(results)
            }

        # Prepare data for regression
        x = np.arange(len(results))
        y = np.array([r.value for r in results if r.value is not None])

        if len(y) < 2:
            return {
                'metric': metric_name,
                'trend': 'insufficient_data',
                'data_points': len(y)
            }

        # Linear regression
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

        # Determine trend direction
        if abs(slope) < 0.01:  # Nearly flat
            direction = 'stable'
        elif slope > 0:
            direction = 'improving' if metric_name in ['success_rate', 'quality_score'] else 'degrading'
        else:
            direction = 'degrading' if metric_name in ['success_rate', 'quality_score'] else 'improving'

        return {
            'metric': metric_name,
            'trend': direction,
            'slope': round(slope, 4),
            'r_squared': round(r_value ** 2, 4),
            'p_value': round(p_value, 4),
            'data_points': len(results),
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        }

    # ==================== Percentiles ====================

    def calculate_percentiles(
        self,
        metric_name: str,
        agent_id: Optional[int] = None
    ) -> Dict[str, float]:
        """
        Calculate percentiles (P50, P75, P90, P95, P99)
        """
        # Build query
        if metric_name == 'execution_time':
            query = self.db.query(AgentMetric.execution_time_ms)
        elif metric_name == 'cost':
            query = self.db.query(AgentMetric.cost_usd)
        elif metric_name == 'tokens':
            query = self.db.query(AgentMetric.tokens_used)
        elif metric_name == 'quality_score':
            query = self.db.query(AgentMetric.quality_score)
        else:
            raise ValueError(f"Invalid metric_name: {metric_name}")

        if agent_id:
            query = query.filter(AgentMetric.agent_id == agent_id)

        # Get all values
        values = [v[0] for v in query.all() if v[0] is not None]

        if not values:
            return {'error': 'No data available'}

        return {
            'p50': round(np.percentile(values, 50), 2),
            'p75': round(np.percentile(values, 75), 2),
            'p90': round(np.percentile(values, 90), 2),
            'p95': round(np.percentile(values, 95), 2),
            'p99': round(np.percentile(values, 99), 2),
            'mean': round(np.mean(values), 2),
            'median': round(np.median(values), 2),
            'std_dev': round(np.std(values), 2),
            'count': len(values)
        }

    # ==================== Outlier Detection ====================

    def identify_outliers(
        self,
        metric_name: str,
        z_threshold: float = 3.0
    ) -> List[Dict[str, Any]]:
        """
        Identify outliers using Z-score method

        Returns records with Z-score > threshold
        """
        # Get metric values
        if metric_name == 'execution_time':
            values_query = self.db.query(
                AgentMetric.id,
                AgentMetric.agent_name,
                AgentMetric.operation_type,
                AgentMetric.execution_time_ms.label('value'),
                AgentMetric.timestamp
            ).filter(AgentMetric.execution_time_ms.isnot(None))
        elif metric_name == 'cost':
            values_query = self.db.query(
                AgentMetric.id,
                AgentMetric.agent_name,
                AgentMetric.operation_type,
                AgentMetric.cost_usd.label('value'),
                AgentMetric.timestamp
            ).filter(AgentMetric.cost_usd.isnot(None))
        else:
            raise ValueError(f"Invalid metric_name: {metric_name}")

        results = values_query.all()

        if len(results) < 10:
            return []

        # Calculate Z-scores
        values = [r.value for r in results]
        mean = np.mean(values)
        std = np.std(values)

        outliers = []
        for record in results:
            z_score = (record.value - mean) / std if std > 0 else 0

            if abs(z_score) > z_threshold:
                outliers.append({
                    'id': record.id,
                    'agent_name': record.agent_name,
                    'operation_type': record.operation_type,
                    'value': round(record.value, 2),
                    'z_score': round(z_score, 2),
                    'deviation_from_mean': round(record.value - mean, 2),
                    'timestamp': record.timestamp.isoformat()
                })

        return sorted(outliers, key=lambda x: abs(x['z_score']), reverse=True)

    # ==================== Cost Optimization ====================

    def get_cost_recommendations(self) -> List[Dict[str, Any]]:
        """
        Generate cost optimization recommendations

        Analyze budget usage patterns and suggest optimizations
        """
        recommendations = []
        budgets = self.db.query(BudgetAllocation).filter(
            BudgetAllocation.status.in_(['active', 'warning', 'critical'])
        ).all()

        for budget in budgets:
            # Get recent metrics (last 30 days)
            recent_metrics = self.db.query(AgentMetric).filter(
                and_(
                    AgentMetric.agent_id == budget.agent_id,
                    AgentMetric.timestamp >= datetime.utcnow() - timedelta(days=30)
                )
            ).all()

            if not recent_metrics:
                continue

            total_tasks = len(recent_metrics)
            avg_utilization = budget.utilization_percent or 0

            # Recommendation 1: Low utilization
            if avg_utilization < 20 and total_tasks < 10:
                new_budget = budget.total_budget_usd * 0.5
                recommendations.append({
                    'type': 'reduce_budget',
                    'priority': 'medium',
                    'agent': budget.agent_name,
                    'agent_role': budget.agent_role,
                    'current_budget': budget.total_budget_usd,
                    'recommended_budget': round(new_budget, 2),
                    'reason': f'Low utilization ({avg_utilization:.1f}%) and minimal activity ({total_tasks} tasks)',
                    'estimated_savings': round(budget.total_budget_usd - new_budget, 2)
                })

            # Recommendation 2: Consistently high quality, could handle more
            quality_scores = [m.quality_score for m in recent_metrics if m.quality_score]
            if quality_scores and np.mean(quality_scores) > 85 and avg_utilization < 50:
                recommendations.append({
                    'type': 'increase_capacity',
                    'priority': 'low',
                    'agent': budget.agent_name,
                    'agent_role': budget.agent_role,
                    'current_budget': budget.total_budget_usd,
                    'recommended_budget': round(budget.total_budget_usd * 1.5, 2),
                    'reason': f'High quality score ({np.mean(quality_scores):.1f}) with capacity ({100-avg_utilization:.1f}% available)',
                    'estimated_savings': 0  # This is an investment
                })

            # Recommendation 3: High cost but low quality
            if quality_scores and np.mean(quality_scores) < 60 and budget.used_budget_usd > budget.total_budget_usd * 0.7:
                recommendations.append({
                    'type': 'review_agent',
                    'priority': 'high',
                    'agent': budget.agent_name,
                    'agent_role': budget.agent_role,
                    'current_budget': budget.total_budget_usd,
                    'recommended_budget': budget.total_budget_usd,
                    'reason': f'High cost (${budget.used_budget_usd:.2f}) but low quality ({np.mean(quality_scores):.1f})',
                    'estimated_savings': 0
                })

            # Recommendation 4: Pause rarely used agents
            if total_tasks < 5 and (datetime.utcnow() - budget.last_used_at).days > 14 if budget.last_used_at else True:
                recommendations.append({
                    'type': 'pause_agent',
                    'priority': 'medium',
                    'agent': budget.agent_name,
                    'agent_role': budget.agent_role,
                    'current_budget': budget.total_budget_usd,
                    'recommended_budget': 0,
                    'reason': f'Rarely used (only {total_tasks} tasks in 30 days)',
                    'estimated_savings': budget.remaining_budget_usd
                })

        return sorted(recommendations, key=lambda x: x['estimated_savings'], reverse=True)

    # ==================== Performance Insights ====================

    def get_performance_insights(self) -> Dict[str, Any]:
        """
        Identify performance patterns and insights
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

        # Fastest agents by operation type
        fastest_by_operation = {}
        operation_types = self.db.query(AgentMetric.operation_type).distinct().all()

        for (op_type,) in operation_types:
            if not op_type:
                continue

            result = self.db.query(
                AgentMetric.agent_name,
                func.avg(AgentMetric.execution_time_ms).label('avg_time')
            ).filter(
                and_(
                    AgentMetric.operation_type == op_type,
                    AgentMetric.timestamp >= start_date,
                    AgentMetric.execution_time_ms.isnot(None)
                )
            ).group_by(AgentMetric.agent_name).order_by(asc('avg_time')).first()

            if result:
                fastest_by_operation[op_type] = {
                    'agent': result.agent_name,
                    'avg_time_ms': round(result.avg_time, 2)
                }

        # Most cost-efficient agents
        cost_efficient = self.db.query(
            AgentMetric.agent_name,
            (func.sum(AgentMetric.cost_usd) / func.count(AgentMetric.id)).label('cost_per_task')
        ).filter(
            AgentMetric.timestamp >= start_date
        ).group_by(AgentMetric.agent_name).order_by(asc('cost_per_task')).limit(10).all()

        # Highest quality agents
        high_quality = self.db.query(
            AgentMetric.agent_name,
            func.avg(AgentMetric.quality_score).label('avg_quality')
        ).filter(
            and_(
                AgentMetric.timestamp >= start_date,
                AgentMetric.quality_score.isnot(None)
            )
        ).group_by(AgentMetric.agent_name).order_by(desc('avg_quality')).limit(10).all()

        # Peak performance hours
        hourly_performance = self.db.query(
            func.extract('hour', AgentMetric.timestamp).label('hour'),
            func.avg(AgentMetric.execution_time_ms).label('avg_time'),
            func.count(AgentMetric.id).label('count')
        ).filter(
            AgentMetric.timestamp >= start_date
        ).group_by('hour').order_by('hour').all()

        peak_hours = sorted(
            [{'hour': int(h.hour), 'avg_time_ms': round(h.avg_time, 2), 'operations': h.count}
             for h in hourly_performance],
            key=lambda x: x['avg_time_ms']
        )[:5]

        # Degrading operations (increasing execution time)
        degrading_ops = []
        for (op_type,) in operation_types:
            if not op_type:
                continue

            trend = self.detect_trends('execution_time', lookback_days=30)
            if trend.get('trend') == 'degrading':
                degrading_ops.append({
                    'operation_type': op_type,
                    'trend': trend
                })

        return {
            'fastest_agents_by_operation': fastest_by_operation,
            'most_cost_efficient': [
                {'agent': r.agent_name, 'cost_per_task_usd': round(r.cost_per_task, 4)}
                for r in cost_efficient
            ],
            'highest_quality': [
                {'agent': r.agent_name, 'avg_quality_score': round(r.avg_quality, 2)}
                for r in high_quality
            ],
            'peak_performance_hours': peak_hours,
            'degrading_operations': degrading_ops
        }
