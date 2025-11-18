"""
Comprehensive tests for metrics aggregation service
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import numpy as np

from app.models.metrics import (
    Base,
    AgentMetric,
    BudgetAllocation,
    MetricsAggregation,
    CostRecommendation,
    PerformanceAlert
)
from app.services.metrics_aggregation import MetricsAggregationService


# Test database setup
@pytest.fixture
def db_session():
    """Create test database session"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    session.close()


@pytest.fixture
def sample_metrics(db_session):
    """Create sample metrics data"""
    metrics = []
    base_time = datetime.utcnow() - timedelta(days=30)

    for i in range(100):
        metric = AgentMetric(
            agent_id=1 + (i % 5),
            agent_name=f'agent_{1 + (i % 5)}',
            agent_role='developer' if i % 2 == 0 else 'reviewer',
            agent_category='code',
            operation_type='code_review' if i % 3 == 0 else 'implementation',
            operation_name=f'task_{i}',
            execution_time_ms=100 + (i * 10) + np.random.normal(0, 20),
            tokens_used=500 + (i * 5),
            api_calls=1,
            success=1 if i % 10 != 0 else 0,  # 10% failure rate
            quality_score=70 + np.random.normal(0, 10),
            cost_usd=0.01 * (i + 1),
            timestamp=base_time + timedelta(hours=i)
        )
        metrics.append(metric)
        db_session.add(metric)

    db_session.commit()
    return metrics


@pytest.fixture
def sample_budgets(db_session):
    """Create sample budget allocations"""
    budgets = []
    for i in range(5):
        budget = BudgetAllocation(
            agent_id=i + 1,
            agent_name=f'agent_{i + 1}',
            agent_role='developer' if i % 2 == 0 else 'reviewer',
            total_budget_usd=100.0,
            used_budget_usd=50.0 + (i * 10),
            remaining_budget_usd=50.0 - (i * 10),
            utilization_percent=50.0 + (i * 10),
            warning_threshold_percent=80.0,
            critical_threshold_percent=95.0,
            status='active',
            last_used_at=datetime.utcnow()
        )
        budgets.append(budget)
        db_session.add(budget)

    db_session.commit()
    return budgets


class TestTimeSeriesAggregation:
    """Test time-series aggregation functionality"""

    def test_daily_aggregation(self, db_session, sample_metrics):
        """Test daily aggregation"""
        service = MetricsAggregationService(db_session)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        results = service.aggregate_by_time(start_date, end_date, 'day')

        assert len(results) > 0
        assert all('timestamp' in r for r in results)
        assert all('total_operations' in r for r in results)
        assert all('success_rate' in r for r in results)

    def test_hourly_aggregation(self, db_session, sample_metrics):
        """Test hourly aggregation"""
        service = MetricsAggregationService(db_session)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=1)

        results = service.aggregate_by_time(start_date, end_date, 'hour')

        assert len(results) > 0

    def test_weekly_aggregation(self, db_session, sample_metrics):
        """Test weekly aggregation"""
        service = MetricsAggregationService(db_session)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

        results = service.aggregate_by_time(start_date, end_date, 'week')

        assert len(results) > 0

    def test_invalid_granularity(self, db_session, sample_metrics):
        """Test invalid granularity raises error"""
        service = MetricsAggregationService(db_session)

        with pytest.raises(ValueError):
            service.aggregate_by_time(
                datetime.utcnow() - timedelta(days=7),
                datetime.utcnow(),
                'invalid'
            )


class TestAgentAggregation:
    """Test agent-level aggregation"""

    def test_agent_aggregation(self, db_session, sample_metrics, sample_budgets):
        """Test agent-specific metrics aggregation"""
        service = MetricsAggregationService(db_session)

        result = service.aggregate_by_agent(1)

        assert result['agent_id'] == 1
        assert 'tasks' in result
        assert 'performance' in result
        assert 'cost' in result
        assert 'quality' in result
        assert result['tasks']['total'] > 0

    def test_agent_with_no_metrics(self, db_session):
        """Test agent with no metrics"""
        service = MetricsAggregationService(db_session)

        result = service.aggregate_by_agent(999)

        assert result['total_tasks'] == 0
        assert 'message' in result

    def test_agent_date_range(self, db_session, sample_metrics):
        """Test agent aggregation with date range"""
        service = MetricsAggregationService(db_session)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        result = service.aggregate_by_agent(1, start_date, end_date)

        assert 'period' in result
        assert result['period']['start'] == start_date.isoformat()


class TestRoleAggregation:
    """Test role-level aggregation"""

    def test_role_aggregation(self, db_session, sample_metrics):
        """Test role-specific aggregation"""
        service = MetricsAggregationService(db_session)

        result = service.aggregate_by_role('developer')

        assert result['role'] == 'developer'
        assert 'summary' in result
        assert 'agents' in result
        assert result['summary']['total_agents'] > 0

    def test_role_comparison(self, db_session, sample_metrics):
        """Test comparison across roles"""
        service = MetricsAggregationService(db_session)

        dev_result = service.aggregate_by_role('developer')
        rev_result = service.aggregate_by_role('reviewer')

        assert dev_result['summary']['total_agents'] > 0
        assert rev_result['summary']['total_agents'] > 0


class TestTrendDetection:
    """Test trend detection functionality"""

    def test_execution_time_trend(self, db_session, sample_metrics):
        """Test execution time trend detection"""
        service = MetricsAggregationService(db_session)

        trend = service.detect_trends('execution_time', lookback_days=30)

        assert 'trend' in trend
        assert 'slope' in trend
        assert trend['trend'] in ['improving', 'degrading', 'stable', 'insufficient_data']

    def test_cost_trend(self, db_session, sample_metrics):
        """Test cost trend detection"""
        service = MetricsAggregationService(db_session)

        trend = service.detect_trends('cost', lookback_days=30)

        assert 'trend' in trend
        assert 'data_points' in trend

    def test_success_rate_trend(self, db_session, sample_metrics):
        """Test success rate trend"""
        service = MetricsAggregationService(db_session)

        trend = service.detect_trends('success_rate', lookback_days=30)

        assert 'trend' in trend

    def test_invalid_metric_name(self, db_session, sample_metrics):
        """Test invalid metric name raises error"""
        service = MetricsAggregationService(db_session)

        with pytest.raises(ValueError):
            service.detect_trends('invalid_metric')


class TestPercentiles:
    """Test percentile calculations"""

    def test_execution_time_percentiles(self, db_session, sample_metrics):
        """Test execution time percentiles"""
        service = MetricsAggregationService(db_session)

        percentiles = service.calculate_percentiles('execution_time')

        assert 'p50' in percentiles
        assert 'p75' in percentiles
        assert 'p90' in percentiles
        assert 'p95' in percentiles
        assert 'p99' in percentiles
        assert 'mean' in percentiles
        assert 'std_dev' in percentiles

    def test_cost_percentiles(self, db_session, sample_metrics):
        """Test cost percentiles"""
        service = MetricsAggregationService(db_session)

        percentiles = service.calculate_percentiles('cost')

        assert percentiles['p99'] >= percentiles['p95']
        assert percentiles['p95'] >= percentiles['p90']

    def test_agent_specific_percentiles(self, db_session, sample_metrics):
        """Test agent-specific percentiles"""
        service = MetricsAggregationService(db_session)

        percentiles = service.calculate_percentiles('execution_time', agent_id=1)

        assert 'count' in percentiles
        assert percentiles['count'] > 0


class TestOutlierDetection:
    """Test outlier detection"""

    def test_execution_time_outliers(self, db_session, sample_metrics):
        """Test execution time outlier detection"""
        service = MetricsAggregationService(db_session)

        # Add some outliers
        outlier = AgentMetric(
            agent_id=1,
            agent_name='agent_1',
            agent_role='developer',
            agent_category='code',
            operation_type='implementation',
            execution_time_ms=10000,  # Extreme outlier
            tokens_used=500,
            success=1,
            cost_usd=1.0,
            timestamp=datetime.utcnow()
        )
        db_session.add(outlier)
        db_session.commit()

        outliers = service.identify_outliers('execution_time', z_threshold=3.0)

        assert len(outliers) > 0
        assert all('z_score' in o for o in outliers)
        assert all('deviation_from_mean' in o for o in outliers)

    def test_cost_outliers(self, db_session, sample_metrics):
        """Test cost outlier detection"""
        service = MetricsAggregationService(db_session)

        outliers = service.identify_outliers('cost', z_threshold=2.0)

        # Should find some outliers with lower threshold
        assert isinstance(outliers, list)


class TestCostRecommendations:
    """Test cost optimization recommendations"""

    def test_low_utilization_recommendation(self, db_session, sample_metrics, sample_budgets):
        """Test low utilization recommendation"""
        service = MetricsAggregationService(db_session)

        # Set low utilization budget
        budget = db_session.query(BudgetAllocation).first()
        budget.utilization_percent = 15.0
        budget.used_budget_usd = 15.0
        db_session.commit()

        recommendations = service.get_cost_recommendations()

        # Should recommend budget reduction
        reduce_recs = [r for r in recommendations if r['type'] == 'reduce_budget']
        assert len(reduce_recs) > 0

    def test_high_quality_recommendation(self, db_session, sample_metrics, sample_budgets):
        """Test high quality agent recommendation"""
        service = MetricsAggregationService(db_session)

        recommendations = service.get_cost_recommendations()

        assert isinstance(recommendations, list)
        assert all('type' in r for r in recommendations)
        assert all('estimated_savings' in r for r in recommendations)

    def test_recommendation_sorting(self, db_session, sample_metrics, sample_budgets):
        """Test recommendations sorted by savings"""
        service = MetricsAggregationService(db_session)

        recommendations = service.get_cost_recommendations()

        if len(recommendations) > 1:
            savings = [r['estimated_savings'] for r in recommendations]
            assert savings == sorted(savings, reverse=True)


class TestPerformanceInsights:
    """Test performance insights generation"""

    def test_fastest_agents(self, db_session, sample_metrics):
        """Test fastest agents identification"""
        service = MetricsAggregationService(db_session)

        insights = service.get_performance_insights()

        assert 'fastest_agents_by_operation' in insights
        assert 'most_cost_efficient' in insights
        assert 'highest_quality' in insights

    def test_cost_efficiency(self, db_session, sample_metrics):
        """Test cost efficiency ranking"""
        service = MetricsAggregationService(db_session)

        insights = service.get_performance_insights()

        efficient_agents = insights['most_cost_efficient']
        assert len(efficient_agents) > 0
        assert all('cost_per_task_usd' in a for a in efficient_agents)

    def test_quality_ranking(self, db_session, sample_metrics):
        """Test quality score ranking"""
        service = MetricsAggregationService(db_session)

        insights = service.get_performance_insights()

        high_quality = insights['highest_quality']
        assert len(high_quality) > 0
        assert all('avg_quality_score' in a for a in high_quality)

    def test_peak_hours(self, db_session, sample_metrics):
        """Test peak performance hours identification"""
        service = MetricsAggregationService(db_session)

        insights = service.get_performance_insights()

        peak_hours = insights['peak_performance_hours']
        assert len(peak_hours) > 0
        assert all('hour' in h for h in peak_hours)
        assert all('avg_time_ms' in h for h in peak_hours)


class TestCaching:
    """Test caching functionality"""

    def test_cache_decorator(self, db_session, sample_metrics):
        """Test cache decorator works"""
        service = MetricsAggregationService(db_session)

        # First call
        result1 = service.aggregate_by_time(
            datetime.utcnow() - timedelta(days=7),
            datetime.utcnow(),
            'day'
        )

        # Second call should use cache
        result2 = service.aggregate_by_time(
            datetime.utcnow() - timedelta(days=7),
            datetime.utcnow(),
            'day'
        )

        # Results should be identical
        assert len(result1) == len(result2)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
