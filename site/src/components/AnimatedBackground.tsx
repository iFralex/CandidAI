export function AnimatedBackground() {
    const blobs = [
        { color: '#8b5cf6', left: '12%', top: '18%' },
        { color: '#a855f7', left: '78%', top: '8%' },
        { color: '#c084fc', left: '45%', top: '62%' },
        { color: '#e879f9', left: '88%', top: '70%' },
        { color: '#f472b6', left: '5%', top: '75%' },
        { color: '#fb7185', left: '60%', top: '30%' },
        { color: '#06b6d4', left: '25%', top: '90%' },
        { color: '#10b981', left: '95%', top: '40%' },
    ];

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-purple-900/20 to-pink-900/20"></div>
            {blobs.map((blob, i) => (
                <div
                    key={i}
                    className="absolute w-72 h-72 rounded-full blur-xl opacity-20 animate-pulse motion-reduce:animate-none"
                    style={{
                        background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
                        left: blob.left,
                        top: blob.top,
                        animationDelay: `${i * 2}s`,
                        animationDuration: `${4 + i}s`,
                    }}
                />
            ))}
        </div>
    );
}
