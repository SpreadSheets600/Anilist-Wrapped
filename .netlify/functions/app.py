import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app import app
import serverless_wsgi


def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
