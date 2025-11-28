from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from app.tasks.task_manager import task_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    task_manager.add_websocket(websocket)
    logger.info("WebSocket client connected")

    try:
        # Send initial status
        await websocket.send_json({
            "type": "connected",
            "data": task_manager.get_current_status()
        })

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Handle any client messages if needed
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            elif data == "status":
                await websocket.send_json({
                    "type": "status",
                    "data": task_manager.get_current_status()
                })
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        task_manager.remove_websocket(websocket)
