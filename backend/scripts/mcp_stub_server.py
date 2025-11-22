import json
import sys

def _send(response):
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break

        try:
            request = json.loads(line.strip())
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        request_id = request.get("id")

        if method == "initialize":
            _send({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {}
                }
            })
        elif method == "tools/list":
            _send({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"tools": []}
            })
        else:
            _send({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32601,
                    "message": "Method not found"
                }
            })


if __name__ == "__main__":
    main()
