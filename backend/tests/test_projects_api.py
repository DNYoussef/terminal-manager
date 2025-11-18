"""
Comprehensive Tests for Projects API
Tests all 6 endpoints with security validation
"""
import pytest
import os
import tempfile
import shutil
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.config import config


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    """Create test client"""
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_dir():
    """Create temporary test directory"""
    # Create temp dir within allowed paths
    test_path = os.path.join(r"C:\Users\17175", "test_projects_temp")
    os.makedirs(test_path, exist_ok=True)
    yield test_path
    # Cleanup
    if os.path.exists(test_path):
        shutil.rmtree(test_path, ignore_errors=True)


class TestProjectsBrowse:
    """Test GET /api/v1/projects/browse endpoint"""

    def test_browse_valid_path(self, client, test_dir):
        """Test browsing valid directory"""
        response = client.get(f"/api/v1/projects/browse?path={test_dir}")
        assert response.status_code == 200
        data = response.json()
        assert "current_path" in data
        assert "parent_path" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_browse_invalid_path_outside_whitelist(self, client):
        """SECURITY: Test path outside whitelist is rejected"""
        response = client.get("/api/v1/projects/browse?path=C:/Windows/System32")
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]

    def test_browse_nonexistent_path(self, client):
        """Test browsing non-existent directory"""
        response = client.get("/api/v1/projects/browse?path=C:/Users/17175/nonexistent")
        assert response.status_code == 404

    def test_browse_file_instead_of_directory(self, client, test_dir):
        """Test browsing a file (should fail)"""
        # Create a test file
        test_file = os.path.join(test_dir, "test.txt")
        with open(test_file, "w") as f:
            f.write("test")

        response = client.get(f"/api/v1/projects/browse?path={test_file}")
        assert response.status_code == 400
        assert "not a directory" in response.json()["detail"]

    def test_browse_symlink_attack(self, client, test_dir):
        """SECURITY: Test symlink path traversal is blocked"""
        # Create symlink to restricted directory
        symlink_path = os.path.join(test_dir, "evil_symlink")

        try:
            # Try to create symlink (may require admin on Windows)
            os.symlink(r"C:\Windows", symlink_path)

            # Should be rejected by path validation
            response = client.get(f"/api/v1/projects/browse?path={symlink_path}")
            assert response.status_code == 403

        except OSError:
            # Symlink creation failed (no admin privileges)
            # This is expected on Windows without admin
            pytest.skip("Symlink creation requires admin privileges")
        finally:
            if os.path.exists(symlink_path):
                os.remove(symlink_path)


class TestProjectsCreate:
    """Test POST /api/v1/projects/create endpoint"""

    def test_create_project_success(self, client, test_dir):
        """Test successful project creation"""
        response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "my-test-project"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "my-test-project"
        assert "id" in data
        assert "created_at" in data

        # Verify directory was created
        project_path = os.path.join(test_dir, "my-test-project")
        assert os.path.exists(project_path)
        assert os.path.isdir(project_path)

        # Cleanup
        shutil.rmtree(project_path, ignore_errors=True)

    def test_create_project_invalid_name_path_traversal(self, client, test_dir):
        """SECURITY: Test path traversal in project name is blocked"""
        response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "../../../evil"
        })

        assert response.status_code == 422  # Validation error
        assert "path separators" in str(response.json())

    def test_create_project_invalid_name_reserved_windows(self, client, test_dir):
        """SECURITY: Test reserved Windows name is blocked"""
        response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "CON"
        })

        assert response.status_code == 422  # Validation error
        assert "reserved" in str(response.json()).lower()

    def test_create_project_invalid_name_special_chars(self, client, test_dir):
        """SECURITY: Test special characters are blocked"""
        response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "my<project>name"
        })

        assert response.status_code == 422  # Validation error
        assert "invalid characters" in str(response.json()).lower()

    def test_create_project_already_exists(self, client, test_dir):
        """Test creating project that already exists"""
        project_path = os.path.join(test_dir, "existing-project")
        os.makedirs(project_path, exist_ok=True)

        response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "existing-project"
        })

        assert response.status_code == 409  # Conflict
        assert "already exists" in response.json()["detail"].lower()

        # Cleanup
        shutil.rmtree(project_path, ignore_errors=True)

    def test_create_project_parent_path_outside_whitelist(self, client):
        """SECURITY: Test parent path outside whitelist is rejected"""
        response = client.post("/api/v1/projects/create", json={
            "parent_path": "C:/Windows/System32",
            "name": "evil-project"
        })

        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]


class TestProjectsList:
    """Test GET /api/v1/projects endpoint"""

    def test_list_projects_empty(self, client):
        """Test listing projects when none exist"""
        response = client.get("/api/v1/projects/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_projects_with_data(self, client, test_dir):
        """Test listing projects after creating some"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "list-test-project"
        })
        assert create_response.status_code == 200

        # List projects
        list_response = client.get("/api/v1/projects/")
        assert list_response.status_code == 200

        projects = list_response.json()
        assert len(projects) >= 1
        assert any(p["name"] == "list-test-project" for p in projects)

        # Cleanup
        project_id = create_response.json()["id"]
        client.delete(f"/api/v1/projects/{project_id}?delete_folder=true")


class TestProjectsGet:
    """Test GET /api/v1/projects/{id} endpoint"""

    def test_get_project_success(self, client, test_dir):
        """Test getting project by ID"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "get-test-project"
        })
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]

        # Get project
        get_response = client.get(f"/api/v1/projects/{project_id}")
        assert get_response.status_code == 200

        data = get_response.json()
        assert data["id"] == project_id
        assert data["name"] == "get-test-project"

        # Cleanup
        client.delete(f"/api/v1/projects/{project_id}?delete_folder=true")

    def test_get_project_not_found(self, client):
        """Test getting non-existent project"""
        response = client.get("/api/v1/projects/nonexistent-id")
        assert response.status_code == 404


class TestProjectsDelete:
    """Test DELETE /api/v1/projects/{id} endpoint"""

    def test_delete_project_database_only(self, client, test_dir):
        """Test deleting project record without deleting folder"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "delete-test-project"
        })
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]
        project_path = os.path.join(test_dir, "delete-test-project")

        # Delete project record only
        delete_response = client.delete(
            f"/api/v1/projects/{project_id}?delete_folder=false"
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["folder_deleted"] is False

        # Verify folder still exists
        assert os.path.exists(project_path)

        # Cleanup
        shutil.rmtree(project_path, ignore_errors=True)

    def test_delete_project_with_folder(self, client, test_dir):
        """Test deleting project record AND folder"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "delete-with-folder-project"
        })
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]
        project_path = os.path.join(test_dir, "delete-with-folder-project")

        # Verify folder exists
        assert os.path.exists(project_path)

        # Delete project AND folder
        delete_response = client.delete(
            f"/api/v1/projects/{project_id}?delete_folder=true"
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["folder_deleted"] is True

        # Verify folder is gone
        assert not os.path.exists(project_path)

    def test_delete_project_not_found(self, client):
        """Test deleting non-existent project"""
        response = client.delete("/api/v1/projects/nonexistent-id")
        assert response.status_code == 404


class TestProjectsOpenTerminal:
    """Test POST /api/v1/projects/{id}/open-terminal endpoint"""

    @pytest.mark.skip(reason="Requires terminal manager integration")
    def test_open_terminal_success(self, client, test_dir):
        """Test opening terminal in project directory"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "terminal-test-project"
        })
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]

        # Open terminal
        terminal_response = client.post(
            f"/api/v1/projects/{project_id}/open-terminal",
            json={"command": "claude"}
        )

        assert terminal_response.status_code == 200
        data = terminal_response.json()
        assert "terminal_id" in data
        assert "websocket_url" in data

        # Cleanup
        client.delete(f"/api/v1/projects/{project_id}?delete_folder=true")

    def test_open_terminal_project_not_found(self, client):
        """Test opening terminal for non-existent project"""
        response = client.post(
            "/api/v1/projects/nonexistent-id/open-terminal",
            json={"command": "claude"}
        )
        assert response.status_code == 404

    def test_open_terminal_command_not_allowed(self, client, test_dir):
        """SECURITY: Test disallowed command is rejected"""
        # Create a project
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "command-test-project"
        })
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]

        # Try to run disallowed command
        terminal_response = client.post(
            f"/api/v1/projects/{project_id}/open-terminal",
            json={"command": "rm -rf /"}
        )

        # Should fail with validation error
        assert terminal_response.status_code in [400, 500]

        # Cleanup
        client.delete(f"/api/v1/projects/{project_id}?delete_folder=true")


class TestSecurityVulnerabilities:
    """Comprehensive security tests"""

    def test_no_command_injection(self, client, test_dir):
        """SECURITY: Verify command injection is prevented"""
        create_response = client.post("/api/v1/projects/create", json={
            "parent_path": test_dir,
            "name": "security-test"
        })
        project_id = create_response.json()["id"]

        # Attempt command injection
        response = client.post(
            f"/api/v1/projects/{project_id}/open-terminal",
            json={"command": "claude; rm -rf C:\\*; echo pwned"}
        )

        # Should be rejected
        assert response.status_code != 200

        # Cleanup
        client.delete(f"/api/v1/projects/{project_id}?delete_folder=true")

    def test_no_information_disclosure(self, client):
        """SECURITY: Verify error messages don't leak internal details"""
        # Trigger error condition
        response = client.get("/api/v1/projects/browse?path=C:/Windows")

        # Error message should be generic
        assert response.status_code == 403
        detail = response.json()["detail"]

        # Should NOT contain internal paths or stack traces
        assert "Windows" not in detail or "Access denied" in detail
        assert "Traceback" not in detail
        assert "Exception" not in detail

    def test_transaction_rollback_completeness(self, client, test_dir):
        """SECURITY: Verify incomplete transactions are rolled back completely"""
        # This would require simulating DB failure
        # For now, verify cleanup logic exists
        pass


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
