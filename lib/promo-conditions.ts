
export type ConditionType = 'BOOLEAN' | 'NUMBER' | 'SELECT';

export interface PromotionCondition {
  id: string;
  label: string;
  description?: string;
  type: ConditionType;
  defaultValue: any;
  // Function to validate if the condition is met
  // context: has all necessary data (previous orders, cart total, time, etc.)
  validator: (value: any, context: ConditionContext) => boolean;
}

export interface ConditionContext {
  previousOrdersCount: number;
  consumedItems?: {
    productId: string;
    categoryId: string | null;
    subcategoryId: string | null;
  }[];
  scope?: {
    productId: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
  };
}

export const PROMO_CONDITIONS: Record<string, PromotionCondition> = {
  first_order_only: {
    id: 'first_order_only',
    label: 'Solo primera orden (del tipo)',
    description: 'Válido solo si es el primer consumo de este producto/categoría',
    type: 'BOOLEAN',
    defaultValue: false,
    validator: (value: boolean, context: ConditionContext) => {
      if (!value) return true;

      // If we have detailed consumption history
      if (context.consumedItems && context.scope) {
        // 1. Product Scope
        if (context.scope.productId) {
            return !context.consumedItems.some(item => item.productId === context.scope?.productId);
        }
        // 2. Subcategory Scope
        if (context.scope.subcategoryId) {
            return !context.consumedItems.some(item => item.subcategoryId === context.scope?.subcategoryId);
        }
        // 3. Category Scope
        if (context.scope.categoryId) {
            return !context.consumedItems.some(item => item.categoryId === context.scope?.categoryId);
        }
      }

      // Fallback: Global check if no detailed history or scope match found
      if (context.previousOrdersCount > 0) {
        return false;
      }
      return true;
    }
  },
  // Example of future condition (not active yet, just for structure)
  /*
  min_order_total: {
    id: 'min_order_total',
    label: 'Monto mínimo de orden',
    type: 'NUMBER',
    defaultValue: 0,
    validator: (value: number, context: ConditionContext) => {
      return (context.currentCartTotal || 0) >= value;
    }
  }
  */
};

// Helper to validate all conditions of a promotion
export function validatePromotionConditions(
  promoConditions: Record<string, any> | null | undefined,
  context: ConditionContext
): boolean {
  if (!promoConditions) return true;

  for (const [key, value] of Object.entries(promoConditions)) {
    const conditionDef = PROMO_CONDITIONS[key];
    if (conditionDef) {
       // If condition exists in registry, run its validator
       if (!conditionDef.validator(value, context)) {
         return false;
       }
    }
  }
  
  return true;
}
