import React from 'react';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

export default function LuxorLogo({ width = "100%", height = 120, color = "white", style }: any) {
    return (
        <Svg width={width} height={height} viewBox="0 0 600 180" style={style}>
            <G x="30" y="40">
                {/* Triángulo estilizado (Pirámide) */}
                <Path d="M0 99 L65 0 L130 99 Z" fill={color} />
                
                {/* Texto LUXOR */}
                <SvgText 
                    x="140" 
                    y="82" 
                    fontFamily="Michroma" 
                    fontSize="64" 
                    fill={color} 
                    textLength="395"
                    lengthAdjust="spacingAndGlyphs"
                >
                    LUXOR
                </SvgText>
                
                {/* Línea Horizontal Base con el CORTE DIAGONAL */}
                <Path d="M3 95 L535 95 L535 99 L0 99 Z" fill={color} />
                
                {/* Texto AUTO HOTEL */}
                <SvgText 
                    x="535" 
                    y="125" 
                    fontFamily="Montserrat" 
                    fontSize="16" 
                    fontWeight="600" 
                    fill={color} 
                    textAnchor="end"
                    letterSpacing="6"
                >
                    AUTO HOTEL
                </SvgText>
            </G>
        </Svg>
    );
}
