from django.urls import path
from . import views

urlpatterns = [
    path("", views.executive_dashboard, name="executive_dashboard"),
    path("supervisor/", views.supervisor_dashboard, name="supervisor_dashboard"),
    path("clients/", views.client_list, name="client_list"),
    path("report/", views.report_view, name="report"),
    path("export/", views.export_view, name="export"),
    path("upload/", views.upload_csv, name="upload_csv"),
]
