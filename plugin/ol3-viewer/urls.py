#
# Copyright (c) 2017 University of Dundee.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

from django.urls import patterns
from django.urls import path
from django.views.generic import TemplateView

import views

urlpatterns = [
    path(r"<int:iid>/", views.index, name="ol3-viewer-index"),
    path(r"plugin/<int:iid>/", views.plugin, name="ol3-viewer-plugin"),
    path(
        r"plugin-debug/<int:iid>/", views.plugin_debug, name="ol3-viewer-plugin-debug"
    ),
]
