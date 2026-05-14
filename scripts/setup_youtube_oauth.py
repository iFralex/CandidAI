"""
Run once on the VPS to authenticate pytubefix with a Google account.
After completing the OAuth flow, the token is cached and all future
downloads work automatically without any interaction.

Usage:
    python scripts/setup_youtube_oauth.py
"""
from pytubefix import YouTube

TEST_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # short public video

print("Starting YouTube OAuth setup...")
print("You will be shown a URL and a code. Open the URL in any browser and enter the code.\n")

yt = YouTube(TEST_URL, use_oauth=True, allow_oauth_cache=True)
yt.streams.first()  # triggers OAuth if not cached

print("\nOAuth setup complete! Token cached. Downloads will now work automatically.")
