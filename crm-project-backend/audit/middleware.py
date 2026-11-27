import threading
from contextlib import contextmanager

_thread_locals = threading.local()


def get_current_request():
    return getattr(_thread_locals, 'request', None)


def get_current_user():
    """
    Resolve the authenticated user making the current request.
    Falls back to lazy JWT Bearer token authentication because DRF runs JWT auth
    after Django's AuthenticationMiddleware.
    """
    req = get_current_request()
    if not req:
        return None

    user = getattr(req, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user

    auth_header = req.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            validated = JWTAuthentication().authenticate(req)
            if validated:
                return validated[0]
        except Exception:
            pass
    return None


def is_audit_skipped():
    return bool(getattr(_thread_locals, 'skip_audit', False))


@contextmanager
def skip_audit_logging():
    prev = getattr(_thread_locals, 'skip_audit', False)
    _thread_locals.skip_audit = True
    try:
        yield
    finally:
        _thread_locals.skip_audit = prev


class AuditRequestMiddleware:
    """Stores the current HttpRequest in thread-local storage for audit delete signals."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        try:
            return self.get_response(request)
        finally:
            if hasattr(_thread_locals, 'request'):
                del _thread_locals.request
