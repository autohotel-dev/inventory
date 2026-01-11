// Training module and step types
export type TrainingMode = 'interactive' | 'practice';

export type TrainingDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TrainingStep {
    id: string;
    title: string;
    description: string;
    // For interactive mode: CSS selector to highlight
    targetSelector?: string;
    // For practice mode: validation function
    validation?: () => boolean;
    // Optional video clip for this specific step
    videoUrl?: string;
    // Tips and shortcuts
    tips?: string[];
    // Delay before showing highlight (ms) - useful for animations
    highlightDelay?: number;
}

export interface TrainingModule {
    id: string;
    title: string;
    description: string;
    icon: string; // Lucide icon name
    duration: number; // in minutes
    difficulty: TrainingDifficulty;
    category: 'rooms' | 'payments' | 'sales' | 'shifts' | 'reports' | 'config' | 'intro' | 'inventory' | 'sensors' | 'admin';
    // Production route for Product Tour mode
    route?: string;
    // Main video tutorial
    videoUrl?: string;
    videoDuration?: string; // e.g., "3:45"
    // Steps for the tutorial
    steps: TrainingStep[];
    // Prerequisites (other module IDs)
    prerequisites?: string[];
}

export interface TrainingProgress {
    userId: string;
    moduleId: string;
    mode: TrainingMode;
    currentStepIndex: number;
    completed: boolean;
    completedAt?: Date;
    startedAt: Date;
}

export interface TrainingContextType {
    // Current state
    activeModule: TrainingModule | null;
    currentMode: TrainingMode | null;
    currentStepIndex: number;
    isTrainingActive: boolean;

    // Actions
    startModule: (moduleId: string, mode: TrainingMode) => void;
    stopTraining: () => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (index: number) => void;
    completeModule: () => void;

    // Progress
    progress: Map<string, TrainingProgress>;
    getModuleProgress: (moduleId: string) => TrainingProgress | undefined;
}
