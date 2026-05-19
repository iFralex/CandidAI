import logging
import requests as http_requests

logger = logging.getLogger(__name__)

BUFFER_GRAPHQL_URL = "https://api.buffer.com/"

_GET_CHANNELS = """
query GetChannels($input: ChannelsInput!) {
  channels(input: $input) {
    id
    name
    service
  }
}
"""

_GET_SCHEDULED_COUNT = """
query GetScheduledCount($input: PostsInput!) {
  posts(input: $input, first: 1) {
    totalCount
  }
}
"""

_CREATE_POST = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        dueAt
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
query GetPosts($input: PostsInput!) {
  posts(input: $input) {
    edges {
      node {
        id
        text
        dueAt
        sentAt
        status
      }
    }
  }
}
"""


class BufferClient:
    def __init__(self, api_key: str, org_id: str = "6a04f34e355697e2b77b9100"):
        self.api_key = api_key
        self.org_id = org_id

    def get_channels(self) -> list[dict]:
        data = self._request(_GET_CHANNELS, {"input": {"organizationId": self.org_id}})
        return data.get("data", {}).get("channels", [])

    def get_scheduled_count(self, channel_id: str) -> int:
        """Return number of posts currently scheduled for a channel."""
        data = self._request(
            _GET_SCHEDULED_COUNT,
            {
                "input": {
                    "organizationId": self.org_id,
                    "filter": {
                        "channelIds": [channel_id],
                        "status": ["scheduled"],
                    },
                },
            },
        )
        return data.get("data", {}).get("posts", {}).get("totalCount", 0)

    def create_post(self, channel_id: str, video_url: str, caption: str,
                    scheduled_at: str, service: str = "") -> str:
        """Schedule a video post. Returns the Buffer post ID."""
        post_input: dict = {
            "channelId": channel_id,
            "text": caption,
            "schedulingType": "automatic",
            "mode": "customScheduled",
            "dueAt": scheduled_at,
            "assets": [{"video": {"url": video_url}}],
        }
        if service == "instagram":
            post_input["metadata"] = {
                "instagram": {"type": "reel", "shouldShareToFeed": True}
            }
        data = self._request(_CREATE_POST, {"input": post_input})
        result = data.get("data", {}).get("createPost", {})
        if "message" in result:
            raise RuntimeError(f"Buffer createPost error: {result.get('message', result)}")
        post = result.get("post", {})
        post_id = post.get("id", "")
        logger.info(f"Buffer post created: {post_id} scheduled at {post.get('dueAt')}")
        return post_id

    def get_published_posts(self, channel_id: str) -> list[dict]:
        """Fetch published posts. Statistics unavailable in new API — counts return 0."""
        data = self._request(
            _GET_POSTS,
            {
                "input": {
                    "organizationId": self.org_id,
                    "filter": {
                        "channelIds": [channel_id],
                        "status": ["sent"],
                    },
                }
            },
        )
        edges = data.get("data", {}).get("posts", {}).get("edges", [])
        posts = []
        for edge in edges:
            node = edge.get("node", {})
            posts.append({
                "id": node.get("id"),
                "text": node.get("text"),
                "scheduled_at": node.get("dueAt") or node.get("sentAt"),
                "impressions": 0,
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "clicks": 0,
                "engagement_rate": 0.0,
            })
        return posts

    def _request(self, query: str, variables: dict = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
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
