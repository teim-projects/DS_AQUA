from rest_framework.permissions import BasePermission


class AuditAccessPermission(BasePermission):
    """
    Allows access to Admin / Sub-Admin / Superusers, or roles explicitly granted
    'audit' permission in Role Management.
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if user.is_superuser:
            return True

        role = getattr(user, 'role', None)
        role_name = (getattr(role, 'name', '') or '').strip().lower()
        if role_name in ('admin', 'sub-admin', 'subadmin'):
            return True

        perms = getattr(role, 'permissions', None) or {}
        audit_perms = perms.get('audit', {}) if isinstance(perms, dict) else {}

        action = getattr(view, 'action', None)
        if action in ('restore', 'settings_update') or request.method in ('PUT', 'PATCH', 'POST'):
            return bool(audit_perms.get('edit') or audit_perms.get('create'))
        if action in ('destroy', 'empty_trash') or request.method == 'DELETE':
            return bool(audit_perms.get('delete'))

        return bool(audit_perms.get('view'))
