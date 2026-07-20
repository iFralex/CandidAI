"use client";

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { Play, Pause, Maximize } from "lucide-react";
import Player from "@vimeo/player";
import Image from "next/image";
import { track } from "@/lib/analytics";

type VideoConfig = {
    vimeoId: string;
    aspect: string;
};

type LegacyFullscreenElement = HTMLDivElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
};

const videos: VideoConfig[] = [
    {
        vimeoId: "1171533200",
        aspect: "aspect-[9/16]"
    },
    {
        vimeoId: "1171533137",
        aspect: "aspect-video"
    }
];

interface HeroVideoProps {
    /** Outer wrapper width constraint. Default matches the original usage (a capped, centered player). Pass "" for a full-bleed presentation. */
    wrapperClassName?: string;
    /** When true, drops the rounded corners / border / shadow from the video frame, for a true edge-to-edge presentation. */
    bare?: boolean;
}

export function HeroVideo({ wrapperClassName = "max-w-5xl mx-auto", bare = false }: HeroVideoProps = {}) {
    const [video, setVideo] = useState<VideoConfig>(videos[0]);
    const containerRef = useRef<LegacyFullscreenElement>(null);
    const playerRef = useRef<Player | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const initPlayer = (e?: ReactMouseEvent) => {
        e?.stopPropagation();
        setInitialized(true);
        track({ name: "landing_video_play", params: { video_id: video.vimeoId } });
    };

    useEffect(() => {
        if (initialized && iframeRef.current && !playerRef.current) {
            const player = new Player(iframeRef.current);
            const videoId = video.vimeoId;
            playerRef.current = player;
            player.on("play", () => setPlaying(true));
            player.on("pause", () => {
                setPlaying(false);
                track({ name: "landing_video_pause", params: { video_id: videoId, watch_time_s: 0 } });
            });
            player.on("ended", () => {
                track({ name: "landing_video_end", params: { video_id: videoId } });
            });
            player.play().catch((error: unknown) => console.log("Errore play:", error));

            return () => {
                playerRef.current = null;
                void player.destroy();
            };
        }
        return undefined;
        // The selected responsive asset is already known when initialization is
        // requested; changing it later should not recreate a playing iframe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialized]);

    const toggleVideo = (e?: ReactMouseEvent) => {
        e?.stopPropagation();
        if (!playerRef.current) return;
        if (playing) {
            playerRef.current.pause();
        } else {
            playerRef.current.setVolume(1);
            playerRef.current.play();
        }
    };

    const enterFullscreen = (e: ReactMouseEvent<HTMLButtonElement>) => {
        e?.stopPropagation();
        if (!containerRef.current) return;
        const container = containerRef.current;
        if (container.requestFullscreen) {
            void container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            void container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            void container.msRequestFullscreen();
        }
    };

    useEffect(() => {
        const checkLayout = () => {
            const width = window.innerWidth;
            setIsMobile(typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

            if (videos && videos.length > 1) {
                if (width >= 1024) {
                    setVideo(videos[1]);
                } else {
                    setVideo(videos[0]);
                }
            }
        };

        checkLayout();
        window.addEventListener("resize", checkLayout);

        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);

        return () => {
            window.removeEventListener("resize", checkLayout);
            document.removeEventListener("fullscreenchange", handler);
        };
    }, []);

    useEffect(() => () => {
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    }, []);

    const wakeControls = () => {
        setShowControls(true);
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        if (playing) {
            idleTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 2000);
        }
    };

    const handleMouseMove = () => {
        if (isMobile) return;
        wakeControls();
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        if (playing) setShowControls(false);
    };

    const handleTouchStart = () => {
        if (isMobile) {
            wakeControls();
            playerRef.current?.setVolume(1);
        }
    };

    useEffect(() => {
        if (!initialized) return;

        if (!playing) {
            setShowControls(true);
            if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        } else {
            wakeControls();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, initialized]);

    const handleContainerClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!initialized) return;

        if (isMobile && !showControls && playing) {
            wakeControls();
            return;
        }

        toggleVideo(e);
    };

    const cursorStyle =
        initialized && playing && !showControls
            ? { cursor: "none" }
            : { cursor: "pointer" };

    const frameClassName = bare
        ? "relative overflow-hidden bg-black " + video.aspect
        : "relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black " + video.aspect;

    return (
        <div className={`relative ${wrapperClassName}`}>
            <div
                ref={containerRef}
                className={frameClassName}
                style={cursorStyle}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onClick={handleContainerClick}
            >
                {initialized && (
                    <iframe
                        ref={iframeRef}
                        src={"https://player.vimeo.com/video/" + video.vimeoId + "?title=0&byline=0&portrait=0&badge=0&controls=0&loop=1"}
                        allow="fullscreen"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        title="Hero Video"
                    />
                )}

                {!initialized && video.vimeoId && (
                    <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
                        onClick={initPlayer}
                    >
                        <Image
                            src={"https://vumbnail.com/" + video.vimeoId + ".jpg"}
                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                            alt="Video thumbnail"
                            width={1920}
                            height={1080}
                        />
                        <div className="relative bg-black/20 backdrop-blur rounded-full p-8 transition-transform hover:scale-110">
                            <Play className="w-12 h-12 text-white fill-white" />
                        </div>
                    </div>
                )}

                {initialized && showControls && (
                    <div
                        className="absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300"
                        onClick={toggleVideo}
                    >
                        {playing ? (
                            <Pause className="w-16 h-16 text-white bg-black/30 rounded-full p-4 backdrop-blur-sm transition-transform hover:scale-110" />
                        ) : (
                            <Play className="w-16 h-16 text-white bg-black/30 rounded-full p-4 backdrop-blur-sm transition-transform hover:scale-110 fill-white" />
                        )}
                    </div>
                )}

                {initialized && !isFullscreen && showControls && !isMobile && (
                    <button
                        onClick={enterFullscreen}
                        className="absolute bottom-4 right-4 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full p-3 z-30 transition-all duration-300"
                    >
                        <Maximize className="w-5 h-5 text-white" />
                    </button>
                )}
            </div>
        </div>
    );
}
