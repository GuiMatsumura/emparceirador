from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ['email', 'username', 'tipo', 'is_active', 'date_joined']
    list_filter = ['tipo', 'is_active', 'is_staff']
    search_fields = ['email', 'username']
    ordering = ['email']
    fieldsets = [*UserAdmin.fieldsets, ('Commander 150', {'fields': ['tipo', 'status']})]
    add_fieldsets = [(None, {'classes': ['wide'], 'fields': ['email', 'username', 'tipo', 'password1', 'password2']})]
