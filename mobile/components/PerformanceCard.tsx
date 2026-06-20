import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../contexts/theme-context';
import { TrendingUp, TrendingDown, Minus, Target, Clock, Zap } from 'lucide-react-native';

interface PerformanceCardProps {
    title: string;
    value: number;
    unit?: string;
    target?: number;
    trend?: number;
    icon: 'clock' | 'target' | 'zap';
    color: string;
}

export function PerformanceCard({ title, value, unit = 'min', target, trend, icon, color }: PerformanceCardProps) {
    const { isDark } = useTheme();

    const isWithinTarget = target ? value <= target : true;
    const trendIcon = trend && trend > 3 ? 'up' : trend && trend < -3 ? 'down' : 'stable';

    const IconComponent = icon === 'clock' ? Clock : icon === 'target' ? Target : Zap;
    const TrendIcon = trendIcon === 'up' ? TrendingUp : trendIcon === 'down' ? TrendingDown : Minus;
    const trendColor = trendIcon === 'up' ? '#10b981' : trendIcon === 'down' ? '#ef4444' : '#6b7280';

    return (
        <View className={`flex-1 rounded-2xl border-2 p-4 ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'
        }`}>
            <View className="flex-row items-center justify-between mb-3">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${color}`}>
                    <IconComponent size={16} color="#fff" />
                </View>
                {trend !== undefined && (
                    <View className="flex-row items-center gap-1">
                        <TrendIcon size={12} color={trendColor} />
                        <Text className="text-xs font-bold" style={{ color: trendColor }}>
                            {Math.abs(trend).toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            <Text className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}>{title}</Text>

            <View className="flex-row items-baseline gap-1">
                <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {value > 0 ? value.toFixed(1) : '—'}
                </Text>
                {value > 0 && (
                    <Text className={`text-sm font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{unit}</Text>
                )}
            </View>

            {target && value > 0 && (
                <View className="mt-2">
                    <View className="flex-row items-center gap-2">
                        <View className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                            isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                        }`}>
                            <View
                                className={`h-full rounded-full ${isWithinTarget ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
                            />
                        </View>
                        <Text className={`text-[10px] font-bold ${isWithinTarget ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isWithinTarget ? '✓' : '✗'} {target}m
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}
