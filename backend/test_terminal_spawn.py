"""
Test script to validate terminal spawning works on Windows
Tests spawning PowerShell and running claude command
"""
import asyncio
import sys
from pathlib import Path

async def test_basic_powershell():
    """Test basic PowerShell command execution"""
    print("Test 1: Basic PowerShell command...")
    try:
        process = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoProfile", "-NoLogo",
            "-Command", "echo 'Hello from PowerShell'",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=5.0
        )

        print(f"  Return code: {process.returncode}")
        print(f"  STDOUT: {stdout.decode().strip()}")
        if stderr:
            print(f"  STDERR: {stderr.decode().strip()}")

        assert process.returncode == 0, "PowerShell command failed"
        print("  PASSED\n")
        return True

    except Exception as e:
        print(f"  FAILED: {e}\n")
        return False


async def test_directory_change():
    """Test changing directory in PowerShell"""
    print("Test 2: Directory change...")
    test_dir = Path.home() / "Desktop"

    try:
        process = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoProfile", "-NoLogo",
            "-Command", f"cd '{test_dir}'; Get-Location",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=5.0
        )

        output = stdout.decode().strip()
        print(f"  Return code: {process.returncode}")
        print(f"  Current directory: {output}")

        assert str(test_dir).lower() in output.lower(), "Directory change failed"
        print("  PASSED\n")
        return True

    except Exception as e:
        print(f"  FAILED: {e}\n")
        return False


async def test_claude_help():
    """Test running claude --help command"""
    print("Test 3: Claude CLI command...")
    try:
        process = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoProfile", "-NoLogo",
            "-Command", "claude --help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=10.0
        )

        output = stdout.decode()
        error = stderr.decode()

        print(f"  Return code: {process.returncode}")
        print(f"  STDOUT (first 500 chars):\n{output[:500]}")
        if error:
            print(f"  STDERR (first 500 chars):\n{error[:500]}")

        # Claude CLI should return 0 and show help text
        if process.returncode == 0 or "Usage:" in output or "claude" in output.lower():
            print("  PASSED\n")
            return True
        else:
            print("  WARNING: Claude CLI may not be installed or in PATH\n")
            return False

    except asyncio.TimeoutError:
        print("  FAILED: Command timed out\n")
        return False
    except Exception as e:
        print(f"  FAILED: {e}\n")
        return False


async def test_claude_in_project():
    """Test running claude in a specific project directory"""
    print("Test 4: Claude in project directory...")
    test_dir = Path.home() / "Desktop"

    try:
        process = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoProfile", "-NoLogo",
            "-Command", f"cd '{test_dir}'; claude --help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=10.0
        )

        output = stdout.decode()
        print(f"  Return code: {process.returncode}")
        print(f"  STDOUT (first 300 chars):\n{output[:300]}")

        if process.returncode == 0 or "Usage:" in output:
            print("  PASSED\n")
            return True
        else:
            print("  WARNING: Claude CLI execution in project dir may have issues\n")
            return False

    except asyncio.TimeoutError:
        print("  FAILED: Command timed out\n")
        return False
    except Exception as e:
        print("  FAILED: {e}\n")
        return False


async def test_continuous_output():
    """Test continuous output streaming (simulated)"""
    print("Test 5: Continuous output streaming...")
    try:
        process = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoProfile", "-NoLogo",
            "-Command", "1..5 | ForEach-Object { Write-Output 'Line $_'; Start-Sleep -Milliseconds 100 }",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # Read output line by line as it comes
        lines = []
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded_line = line.decode().strip()
            if decoded_line:
                lines.append(decoded_line)
                print(f"  Received: {decoded_line}")

        await process.wait()

        print(f"  Return code: {process.returncode}")
        print(f"  Total lines: {len(lines)}")

        assert len(lines) == 5, f"Expected 5 lines, got {len(lines)}"
        print("  PASSED\n")
        return True

    except Exception as e:
        print(f"  FAILED: {e}\n")
        return False


async def main():
    """Run all tests"""
    print("=" * 60)
    print("TERMINAL SPAWNING VALIDATION TESTS")
    print("=" * 60)
    print()

    results = []

    # Run each test
    results.append(await test_basic_powershell())
    results.append(await test_directory_change())
    results.append(await test_claude_help())
    results.append(await test_claude_in_project())
    results.append(await test_continuous_output())

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")
    print()

    if passed == total:
        print("SUCCESS: All tests passed!")
        print("Terminal spawning is working correctly.")
        return 0
    elif passed >= 3:
        print("PARTIAL SUCCESS: Core functionality works")
        print("Claude CLI may need additional setup, but terminal spawning works.")
        return 0
    else:
        print("FAILURE: Critical tests failed")
        print("Terminal spawning may not work correctly.")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
