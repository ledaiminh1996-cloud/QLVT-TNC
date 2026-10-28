import React from 'react';

interface TncLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export const TncLogo: React.FC<TncLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  theme = 'auto'
}) => {
  // Height configurations
  const heightClass = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9';

  return (
    <div className={`inline-flex items-center ${className}`}>
      <svg
        viewBox="0 0 320 95"
        role="img"
        aria-label="Tân Nam Chinh"
        className={`${heightClass} w-auto max-w-full select-none`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          {/* Green leaf gradient for the stylized 'i' body */}
          <linearGradient id="tncGreenGrad" x1="0%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#96D13D" />
            <stop offset="35%" stopColor="#82BC35" />
            <stop offset="70%" stopColor="#009245" />
            <stop offset="100%" stopColor="#006837" />
          </linearGradient>
          
          {/* Subtle drop shadow for depth */}
          <filter id="tncSubtleShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Text "TânNamCh" in Official Bold Brand Blue */}
        <text
          x="6"
          y="56"
          fill="#0072BC"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Montserrat', 'Arial Black', sans-serif"
          fontWeight="900"
          fontSize="46"
          letterSpacing="-1.5"
        >
          TânNamCh
        </text>

        {/* Stylized 'i' element: Red circular dot */}
        <circle
          cx="226"
          cy="22"
          r="13.5"
          fill="#E52427"
          filter="url(#tncSubtleShadow)"
        />

        {/* Stylized 'i' element: Curving green leaf & swoosh */}
        <path
          d="M 216 43 
             C 214 55, 210 70, 222 84 
             C 230 93, 246 95, 260 85 
             C 268 79, 274 70, 276 66 
             C 272 70, 264 78, 252 82 
             C 241 85, 230 83, 224 74 
             C 217 65, 220 53, 224 43 
             C 225 40, 228 36, 233 42 
             C 239 49, 245 56, 241 68 
             C 238 74, 233 78, 230 79 
             C 234 77, 240 73, 243 65 
             C 247 54, 239 44, 233 39 
             C 228 35, 220 38, 216 43 Z"
          fill="url(#tncGreenGrad)"
          filter="url(#tncSubtleShadow)"
        />

        {/* Text "nh" in Official Bold Brand Blue */}
        <text
          x="239"
          y="56"
          fill="#0072BC"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Montserrat', 'Arial Black', sans-serif"
          fontWeight="900"
          fontSize="46"
          letterSpacing="-1.5"
        >
          nh
        </text>

        {/* Registered Trademark ® Symbol */}
        <circle
          cx="294"
          cy="24"
          r="6"
          stroke="#0072BC"
          strokeWidth="1.2"
          fill="none"
        />
        <text
          x="294"
          y="27"
          textAnchor="middle"
          fill="#0072BC"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
          fontSize="7.5"
        >
          R
        </text>

        {/* Subtitle "VIETNAM LOGISTICS" */}
        {showSubtitle && (
          <>
            <text
              x="76"
              y="74"
              fill="#006837"
              fontFamily="system-ui, -apple-system, 'Arial', sans-serif"
              fontStyle="italic"
              fontWeight="900"
              fontSize="12.5"
              letterSpacing="2.5"
            >
              VIETNAM LOGIST
            </text>
            <text
              x="228"
              y="74"
              fill="#006837"
              fontFamily="system-ui, -apple-system, 'Arial', sans-serif"
              fontStyle="italic"
              fontWeight="900"
              fontSize="12.5"
              letterSpacing="2"
            >
              CS
            </text>
          </>
        )}
      </svg>
    </div>
  );
};
