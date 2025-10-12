import { Review, reviews } from "@/components/reviews";
import { headers } from "next/headers";

export default async function AuthLayout({children}) {
  const email = ""//(await headers()).get("x-email")
  
  return (
    <div className="grid min-h-svh lg:grid-cols-2 max-h-svh overflow-hidden">
      <div className="flex flex-col gap-4 relative z-10 overflow-y-scroll max-h-svh" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div className="flex flex-1 items-center justify-center relative py-10">
          <div className="absolute inset-0 -z-10 rounded-2xl">
            {/* base background */}
            <div className="w-full h-full bg-background">
              {/* pattern a gocce oblique */}
              <div className="w-full h-full bg-[repeating-linear-gradient(45deg,theme(colors.violet.500)_0px,theme(colors.violet.500)_2px,transparent_2px,transparent_40px,theme(colors.purple.600)_40px,theme(colors.purple.600)_42px,transparent_42px,transparent_80px)] opacity-30" />
            </div>
          </div>
          <div className="w-full max-w-sm p-6 md:p-10">
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block max-h-svh overflow-hidden">
        <div className="absolute inset-0 -z-10 rounded-2xl overflow-hidden">
          <div className="w-full h-full bg-[linear-gradient(135deg,theme(colors.violet.500),theme(colors.purple.600))]">
            <div className="w-full h-full bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.1)_0px,rgba(255,255,255,0.1)_2px,transparent_2px,transparent_8px)]" />
          </div>
        </div>
        <VioletMosaic />
        <div className="absolute bottom-0">
          <div className="mt-16 p-5 max-h-svh overflow-y-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.sort(() => 0.5 - Math.random()).slice(0, 3).map((review, index) => (
                <Review review={review} key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VioletMosaic() {
  const gradients = [
    'from-violet-400 to-purple-600',
    'from-violet-500 to-purple-500',
    'from-purple-400 to-violet-700',
    'from-violet-600 to-purple-400',
    'from-purple-500 to-violet-600',
    'from-violet-500 to-purple-700',
    'from-purple-600 to-violet-500',
    'from-violet-400 to-purple-700',
    'from-purple-600 to-violet-400',
    'from-violet-600 to-purple-500'
  ];

  const borders = [
    'border-violet-300',
    'border-purple-300',
    'border-violet-400',
    'border-purple-400'
  ];

  // Percentuali di altezza dello schermo con minimo in rem
  const heightPercentages = [8, 12, 16, 20, 24, 28, 32, 36]; // percentuali da 8% a 36%
  const minHeightRem = 5; // altezza minima in rem

  const generateColumn = (colIndex) => {
    const tiles = [];
    let totalPercentage = 0;

    while (totalPercentage < 100) {
      const heightPerc = heightPercentages[Math.floor((colIndex * 7 + tiles.length * 3) % heightPercentages.length)];
      const gradient = gradients[Math.floor((colIndex * 5 + tiles.length * 2) % gradients.length)];
      const border = borders[Math.floor((colIndex + tiles.length) % borders.length)];
      const direction = (colIndex + tiles.length) % 2 === 0 ? 'bg-gradient-to-b' : 'bg-gradient-to-t';

      tiles.push(
        <div
          key={tiles.length}
          className={`${direction} ${gradient} border-0 ${border} rounded-full`}
          style={{
            height: `max(${heightPerc}vh, ${minHeightRem}rem)`
          }}
        />
      );

      totalPercentage += heightPerc;
    }

    return tiles;
  };

  return (
    <div className="absolute inset-0 -z-10">
      <div className="min-h-screen grid grid-cols-12 gap-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="col-span-1 flex flex-col gap-2">
            {generateColumn(i)}
          </div>
        ))}
      </div>
    </div>
  );
}