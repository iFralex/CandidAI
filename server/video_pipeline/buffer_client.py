import logging
import requests as http_requests

logger = logging.getLogger(__name__)

BUFFER_GRAPHQL_URL = "https://graph.buffer.com/"

_GET_CHANNELS = """
query GetChannels {
  channels {
    id
    name
    service
    scheduledPostsCount
  }
}
"""

_CREATE_POST = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        scheduledAt
        status
      }
    }
    ... on MutationError {
      message
    }
  }
}
"""

_GET_POSTS = """
query GetPosts($channelId: String!, $status: String) {
  channel(id: $channelId) {
    posts(status: $status) {
      edges {
        node {
          id
          text
          scheduledAt
          status
          statistics {
            impressions
            reactions
            comments
            shares
            clicks
            engagementRate
          }
        }
      }
    }
  }
}
"""


class BufferClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_channels(self) -> list[dict]:
        data = self._request(_GET_CHANNELS)
        return data.get("data", {}).get("channels", [])

    def get_scheduled_count(self, channel_id: str) -> int:
        """Return number of posts currently scheduled for a channel."""
        channels = self.get_channels()
        for ch in channels:
            if ch["id"] == channel_id:
                return ch.get("scheduledPostsCount", 0)
        return 0

    def create_post(self, channel_id: str, video_url: str, caption: str,
                    scheduled_at: str) -> str:
        """Schedule a video post. Returns the Buffer post ID."""
        payload = self._build_create_post_payload(channel_id, video_url, caption, scheduled_at)
        data = self._request(payload["query"], payload["variables"])
        result = data.get("data", {}).get("createPost", {})
        if result.get("__typename") == "MutationError" or "message" in result:
            raise RuntimeError(f"Buffer createPost error: {result.get('message', result)}")
        post = result.get("post", {})
        post_id = post.get("id", "")
        logger.info(f"Buffer post created: {post_id} scheduled at {post.get('scheduledAt')}")
        return post_id

    def get_published_posts(self, channel_id: str) -> list[dict]:
        """Fetch published posts with statistics."""
        data = self._request(_GET_POSTS, {"channelId": channel_id, "status": "sent"})
        edges = (
            data.get("data", {})
                .get("channel", {})
                .get("posts", {})
                .get("edges", [])
        )
        posts = []
        for edge in edges:
            node = edge.get("node", {})
            stats = node.get("statistics") or {}
            posts.append({
                "id": node.get("id"),
                "text": node.get("text"),
                "scheduled_at": node.get("scheduledAt"),
                "impressions": stats.get("impressions", 0),
                "likes": stats.get("reactions", 0),
                "comments": stats.get("comments", 0),
                "shares": stats.get("shares", 0),
                "clicks": stats.get("clicks", 0),
                "engagement_rate": stats.get("engagementRate", 0.0),
            })
        return posts

    def _build_create_post_payload(self, channel_id: str, video_url: str,
                                    caption: str, scheduled_at: str) -> dict:
        return {
            "query": _CREATE_POST,
            "variables": {
                "input": {
                    "channelId": channel_id,
                    "text": caption,
                    "schedulingType": "customScheduled",
                    "dueAt": scheduled_at,
                    "assets": {
                        "videos": [{"url": video_url}]
                    }
                }
            }
        }

    def _request(self, query: str, variables: dict = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {"query": query, "variables": variables or {}}
        response = http_requests.post(
            BUFFER_GRAPHQL_URL, json=payload, headers=headers, timeout=30
        )
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise RuntimeError(f"Buffer GraphQL errors: {data['errors']}")
        return data
