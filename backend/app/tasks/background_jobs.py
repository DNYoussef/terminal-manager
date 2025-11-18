"""
Background jobs for metrics aggregation and monitoring
"""
import asyncio
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.metrics import (
    AgentMetric,
    BudgetAllocation,
    MetricsAggregation,
    CostRecommendation,
    PerformanceAlert
)
from app.services.metrics_aggregation import MetricsAggregationService
from app.services.cache import invalidate_cache_pattern


class BackgroundJobsService:
    """Scheduled background jobs for metrics processing"""

    def __init__(self):
        self.db = None

    def get_db_session(self) -> Session:
        """Get database session"""
        if not self.db:
            self.db = next(get_db())
        return self.db

    async def run_daily_aggregation(self):
        """
        Run daily aggregations at midnight
        Calculate and store pre-aggregated metrics for performance
        """
        print(f"[{datetime.utcnow()}] Running daily aggregation...")

        db = self.get_db_session()
        service = MetricsAggregationService(db)

        try:
            # Calculate yesterday's aggregations
            yesterday = datetime.utcnow() - timedelta(days=1)
            start_of_day = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)

            # Aggregate by day
            daily_metrics = service.aggregate_by_time(
                start_date=start_of_day,
                end_date=end_of_day,
                granularity='day'
            )

            # Store aggregations
            for metric in daily_metrics:
                agg = MetricsAggregation(
                    aggregation_type='timeseries',
                    granularity='day',
                    period_start=start_of_day,
                    period_end=end_of_day,
                    total_operations=metric['total_operations'],
                    successful_operations=metric['successful_operations'],
                    failed_operations=metric['failed_operations'],
                    success_rate=metric['success_rate'],
                    avg_execution_time_ms=metric['avg_execution_time_ms'],
                    total_tokens=metric['total_tokens'],
                    total_cost_usd=metric['total_cost_usd'],
                    avg_quality_score=metric['avg_quality_score']
                )
                db.add(agg)

            db.commit()

            # Invalidate cache
            invalidate_cache_pattern("metrics:*")

            print(f"Daily aggregation completed: {len(daily_metrics)} metrics stored")

        except Exception as e:
            print(f"Error in daily aggregation: {e}")
            db.rollback()

    async def run_weekly_reports(self):
        """
        Generate weekly reports on Sundays
        """
        print(f"[{datetime.utcnow()}] Generating weekly reports...")

        db = self.get_db_session()
        service = MetricsAggregationService(db)

        try:
            # Get last week's data
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)

            # Weekly aggregation
            weekly_metrics = service.aggregate_by_time(
                start_date=start_date,
                end_date=end_date,
                granularity='week'
            )

            # Store weekly aggregation
            for metric in weekly_metrics:
                agg = MetricsAggregation(
                    aggregation_type='timeseries',
                    granularity='week',
                    period_start=start_date,
                    period_end=end_date,
                    total_operations=metric['total_operations'],
                    successful_operations=metric['successful_operations'],
                    failed_operations=metric['failed_operations'],
                    success_rate=metric['success_rate'],
                    avg_execution_time_ms=metric['avg_execution_time_ms'],
                    total_tokens=metric['total_tokens'],
                    total_cost_usd=metric['total_cost_usd'],
                    avg_quality_score=metric['avg_quality_score']
                )
                db.add(agg)

            db.commit()

            print(f"Weekly report generated: {len(weekly_metrics)} metrics")

            # TODO: Send email reports to stakeholders

        except Exception as e:
            print(f"Error in weekly reports: {e}")
            db.rollback()

    async def detect_anomalies(self):
        """
        Detect anomalies and create alerts
        Runs every hour
        """
        print(f"[{datetime.utcnow()}] Running anomaly detection...")

        db = self.get_db_session()
        service = MetricsAggregationService(db)

        try:
            # Detect outliers in execution time
            exec_time_outliers = service.identify_outliers('execution_time', z_threshold=3.0)

            for outlier in exec_time_outliers[:10]:  # Limit to top 10
                # Check if alert already exists
                existing = db.query(PerformanceAlert).filter(
                    PerformanceAlert.agent_name == outlier['agent_name'],
                    PerformanceAlert.alert_type == 'outlier',
                    PerformanceAlert.metric_name == 'execution_time',
                    PerformanceAlert.status == 'active'
                ).first()

                if not existing:
                    alert = PerformanceAlert(
                        agent_name=outlier['agent_name'],
                        alert_type='outlier',
                        severity='warning' if abs(outlier['z_score']) < 4 else 'error',
                        metric_name='execution_time',
                        current_value=outlier['value'],
                        threshold_value=3.0,
                        deviation_percent=abs(outlier['z_score']) * 100,
                        message=f"Execution time outlier detected: {outlier['value']:.2f}ms (Z-score: {outlier['z_score']:.2f})",
                        details_json=outlier
                    )
                    db.add(alert)

            # Detect cost outliers
            cost_outliers = service.identify_outliers('cost', z_threshold=3.0)

            for outlier in cost_outliers[:10]:
                existing = db.query(PerformanceAlert).filter(
                    PerformanceAlert.agent_name == outlier['agent_name'],
                    PerformanceAlert.alert_type == 'outlier',
                    PerformanceAlert.metric_name == 'cost',
                    PerformanceAlert.status == 'active'
                ).first()

                if not existing:
                    alert = PerformanceAlert(
                        agent_name=outlier['agent_name'],
                        alert_type='outlier',
                        severity='warning' if abs(outlier['z_score']) < 4 else 'error',
                        metric_name='cost',
                        current_value=outlier['value'],
                        threshold_value=3.0,
                        deviation_percent=abs(outlier['z_score']) * 100,
                        message=f"Cost outlier detected: ${outlier['value']:.4f} (Z-score: {outlier['z_score']:.2f})",
                        details_json=outlier
                    )
                    db.add(alert)

            db.commit()
            print(f"Anomaly detection completed: {len(exec_time_outliers)} execution time outliers, {len(cost_outliers)} cost outliers")

        except Exception as e:
            print(f"Error in anomaly detection: {e}")
            db.rollback()

    async def check_budget_overruns(self):
        """
        Check for budget overruns and send alerts
        Runs every hour
        """
        print(f"[{datetime.utcnow()}] Checking budget overruns...")

        db = self.get_db_session()

        try:
            # Get all budgets approaching limits
            budgets = db.query(BudgetAllocation).filter(
                BudgetAllocation.utilization_percent >= BudgetAllocation.warning_threshold_percent
            ).all()

            for budget in budgets:
                # Check if alert already exists
                existing = db.query(PerformanceAlert).filter(
                    PerformanceAlert.agent_id == budget.agent_id,
                    PerformanceAlert.alert_type == 'budget_overrun',
                    PerformanceAlert.status == 'active'
                ).first()

                if not existing:
                    severity = 'warning'
                    if budget.utilization_percent >= budget.critical_threshold_percent:
                        severity = 'critical'
                    elif budget.utilization_percent >= 100:
                        severity = 'error'

                    alert = PerformanceAlert(
                        agent_id=budget.agent_id,
                        agent_name=budget.agent_name,
                        alert_type='budget_overrun',
                        severity=severity,
                        metric_name='budget_utilization',
                        current_value=budget.used_budget_usd,
                        expected_value=budget.total_budget_usd,
                        threshold_value=budget.total_budget_usd * budget.warning_threshold_percent / 100,
                        deviation_percent=budget.utilization_percent - 100,
                        message=f"Budget alert: {budget.agent_name} at {budget.utilization_percent:.1f}% utilization (${budget.used_budget_usd:.2f}/${budget.total_budget_usd:.2f})",
                        details_json={
                            'total_budget': budget.total_budget_usd,
                            'used_budget': budget.used_budget_usd,
                            'remaining_budget': budget.remaining_budget_usd,
                            'utilization_percent': budget.utilization_percent
                        }
                    )
                    db.add(alert)

            db.commit()
            print(f"Budget check completed: {len(budgets)} budgets at or above warning threshold")

        except Exception as e:
            print(f"Error checking budget overruns: {e}")
            db.rollback()

    async def generate_cost_recommendations(self):
        """
        Generate cost optimization recommendations
        Runs daily
        """
        print(f"[{datetime.utcnow()}] Generating cost recommendations...")

        db = self.get_db_session()
        service = MetricsAggregationService(db)

        try:
            # Clear old recommendations (older than 7 days)
            old_date = datetime.utcnow() - timedelta(days=7)
            db.query(CostRecommendation).filter(
                CostRecommendation.created_at < old_date,
                CostRecommendation.status == 'pending'
            ).delete()

            # Generate new recommendations
            recommendations = service.get_cost_recommendations()

            for rec in recommendations:
                # Check if similar recommendation already exists
                existing = db.query(CostRecommendation).filter(
                    CostRecommendation.agent_name == rec['agent'],
                    CostRecommendation.recommendation_type == rec['type'],
                    CostRecommendation.status == 'pending'
                ).first()

                if not existing:
                    recommendation = CostRecommendation(
                        agent_name=rec['agent'],
                        recommendation_type=rec['type'],
                        priority=rec['priority'],
                        current_budget_usd=rec['current_budget'],
                        recommended_budget_usd=rec['recommended_budget'],
                        estimated_savings_usd=rec['estimated_savings'],
                        reason=rec['reason'],
                        details_json=rec,
                        expires_at=datetime.utcnow() + timedelta(days=7)
                    )
                    db.add(recommendation)

            db.commit()
            print(f"Cost recommendations generated: {len(recommendations)} new recommendations")

        except Exception as e:
            print(f"Error generating cost recommendations: {e}")
            db.rollback()

    async def cleanup_old_metrics(self, retention_days: int = 90):
        """
        Clean up old metrics data
        Runs monthly
        """
        print(f"[{datetime.utcnow()}] Cleaning up old metrics...")

        db = self.get_db_session()

        try:
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

            # Delete old metrics
            deleted = db.query(AgentMetric).filter(
                AgentMetric.timestamp < cutoff_date
            ).delete()

            db.commit()
            print(f"Cleanup completed: {deleted} old metrics deleted")

        except Exception as e:
            print(f"Error cleaning up metrics: {e}")
            db.rollback()


# Global instance
background_jobs = BackgroundJobsService()


async def scheduler_loop():
    """
    Main scheduler loop
    Run different jobs at different intervals
    """
    last_daily = None
    last_weekly = None
    last_hourly = None
    last_monthly = None

    while True:
        now = datetime.utcnow()

        # Daily jobs (at midnight UTC)
        if not last_daily or (now.hour == 0 and last_daily.day != now.day):
            await background_jobs.run_daily_aggregation()
            await background_jobs.generate_cost_recommendations()
            last_daily = now

        # Weekly jobs (Sunday at midnight)
        if not last_weekly or (now.weekday() == 6 and now.hour == 0 and last_weekly.day != now.day):
            await background_jobs.run_weekly_reports()
            last_weekly = now

        # Hourly jobs
        if not last_hourly or (now.hour != last_hourly.hour):
            await background_jobs.detect_anomalies()
            await background_jobs.check_budget_overruns()
            last_hourly = now

        # Monthly jobs (1st of month at midnight)
        if not last_monthly or (now.day == 1 and now.hour == 0 and last_monthly.month != now.month):
            await background_jobs.cleanup_old_metrics(retention_days=90)
            last_monthly = now

        # Sleep for 5 minutes before checking again
        await asyncio.sleep(300)


if __name__ == "__main__":
    # Run scheduler
    asyncio.run(scheduler_loop())
