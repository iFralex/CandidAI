export const ProgressBar = ({ progress, className = '' }) => {
    return (
        <div className={`w-full bg-white/10 rounded-full h-2 overflow-hidden ${className}`}>
            <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
        </div>
    );
};