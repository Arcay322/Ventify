import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DiscountSettings {
  cashierMaxDiscount: number;
  cashierMaxDiscountType: 'amount' | 'percentage';
  managerMaxDiscount: number;
  managerMaxDiscountType: 'amount' | 'percentage';
  requireApprovalAbove: number;
  allowNegativeInventory: boolean;
  trackDiscountReasons: boolean;
}

export const DEFAULT_DISCOUNT_SETTINGS: DiscountSettings = {
  cashierMaxDiscount: 20,
  cashierMaxDiscountType: 'amount',
  managerMaxDiscount: 50,
  managerMaxDiscountType: 'percentage',
  requireApprovalAbove: 100,
  allowNegativeInventory: false,
  trackDiscountReasons: true
};

export class DiscountSettingsService {
  static async getDiscountSettings(accountId: string): Promise<DiscountSettings> {
    try {
      const settingsRef = doc(db, 'accounts', accountId, 'settings', 'discounts');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        return { ...DEFAULT_DISCOUNT_SETTINGS, ...settingsDoc.data() } as DiscountSettings;
      }
      
      return DEFAULT_DISCOUNT_SETTINGS;
    } catch (error) {
      console.error('Error getting discount settings:', error);
      return DEFAULT_DISCOUNT_SETTINGS;
    }
  }

  static async updateDiscountSettings(accountId: string, settings: DiscountSettings): Promise<void> {
    try {
      const settingsRef = doc(db, 'accounts', accountId, 'settings', 'discounts');
      await setDoc(settingsRef, settings);
    } catch (error) {
      console.error('Error updating discount settings:', error);
      throw error;
    }
  }

  static calculateMaxDiscount(
    settings: DiscountSettings, 
    userRole: string, 
    totalAmount: number
  ): number {
    let maxDiscount = 0;
    
    switch (userRole) {
      case 'cashier':
        if (settings.cashierMaxDiscountType === 'amount') {
          maxDiscount = settings.cashierMaxDiscount;
        } else {
          maxDiscount = (totalAmount * settings.cashierMaxDiscount) / 100;
        }
        break;
        
      case 'manager':
        if (settings.managerMaxDiscountType === 'amount') {
          maxDiscount = settings.managerMaxDiscount;
        } else {
          maxDiscount = (totalAmount * settings.managerMaxDiscount) / 100;
        }
        break;
        
      case 'admin':
      case 'owner':
        maxDiscount = totalAmount; // Sin límite para admin y owner
        break;
        
      default:
        maxDiscount = 0;
    }
    
    return Math.min(maxDiscount, totalAmount);
  }

  static requiresApproval(
    settings: DiscountSettings, 
    discountAmount: number
  ): boolean {
    return discountAmount > settings.requireApprovalAbove;
  }
}