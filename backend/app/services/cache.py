"""
Caching layer with Redis support and in-memory fallback
"""
import json
import time
from typing import Any, Optional
from functools import wraps

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class CacheService:
    """Caching service with Redis and in-memory fallback"""

    def __init__(self, redis_url: Optional[str] = None, default_ttl: int = 300):
        self.default_ttl = default_ttl
        self.redis_client = None
        self.memory_cache = {}
        self.cache_timestamps = {}

        # Try to connect to Redis
        if REDIS_AVAILABLE and redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                self.redis_client.ping()
                print("Connected to Redis for caching")
            except Exception as e:
                print(f"Redis connection failed: {e}. Using in-memory cache.")
                self.redis_client = None
        else:
            print("Redis not available. Using in-memory cache.")

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.redis_client:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            else:
                # Check in-memory cache
                if key in self.memory_cache:
                    timestamp = self.cache_timestamps.get(key, 0)
                    if time.time() - timestamp < self.default_ttl:
                        return self.memory_cache[key]
                    else:
                        # Expired
                        del self.memory_cache[key]
                        del self.cache_timestamps[key]
        except Exception as e:
            print(f"Cache get error: {e}")
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache"""
        ttl = ttl or self.default_ttl
        try:
            if self.redis_client:
                self.redis_client.setex(
                    key,
                    ttl,
                    json.dumps(value, default=str)
                )
                return True
            else:
                # In-memory cache
                self.memory_cache[key] = value
                self.cache_timestamps[key] = time.time()
                return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if self.redis_client:
                self.redis_client.delete(key)
            else:
                if key in self.memory_cache:
                    del self.memory_cache[key]
                    del self.cache_timestamps[key]
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        count = 0
        try:
            if self.redis_client:
                keys = self.redis_client.keys(pattern)
                if keys:
                    count = self.redis_client.delete(*keys)
            else:
                # In-memory pattern matching
                keys_to_delete = [k for k in self.memory_cache.keys() if self._match_pattern(k, pattern)]
                for key in keys_to_delete:
                    del self.memory_cache[key]
                    del self.cache_timestamps[key]
                count = len(keys_to_delete)
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
        return count

    def _match_pattern(self, key: str, pattern: str) -> bool:
        """Simple pattern matching for in-memory cache"""
        if '*' in pattern:
            parts = pattern.split('*')
            if len(parts) == 2:
                return key.startswith(parts[0]) and key.endswith(parts[1])
        return key == pattern

    def clear_all(self) -> bool:
        """Clear all cache"""
        try:
            if self.redis_client:
                self.redis_client.flushdb()
            else:
                self.memory_cache.clear()
                self.cache_timestamps.clear()
            return True
        except Exception as e:
            print(f"Cache clear error: {e}")
            return False


# Global cache instance
cache_service = CacheService(
    redis_url=None,  # Will use in-memory by default
    default_ttl=300  # 5 minutes
)


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator for caching function results

    Usage:
        @cached(ttl=600, key_prefix="metrics")
        def expensive_function(arg1, arg2):
            return some_result
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)

            # Try to get from cache
            cached_value = cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Execute function
            result = func(*args, **kwargs)

            # Store in cache
            cache_service.set(cache_key, result, ttl)

            return result
        return wrapper
    return decorator


def invalidate_cache_pattern(pattern: str):
    """Invalidate all cache keys matching pattern"""
    return cache_service.delete_pattern(pattern)


def invalidate_cache_key(key: str):
    """Invalidate specific cache key"""
    return cache_service.delete(key)
