'use server';

/**
 * @fileOverview Analyzes stock levels and historical sales data to suggest optimal reordering quantities when inventory is low.
 *
 * - analyzeReorderingRequirements - A function that handles the analysis of reordering requirements.
 * - AnalyzeReorderingRequirementsInput - The input type for the analyzeReorderingRequirements function.
 * - AnalyzeReorderingRequirementsOutput - The return type for the analyzeReorderingRequirements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeReorderingRequirementsInputSchema = z.object({
  productId: z.string().describe('The ID of the product to analyze.'),
  currentStockLevel: z.number().describe('The current stock level of the product.'),
  historicalSalesData: z.string().describe('Historical sales data for the product, as a JSON string.'),
  leadTimeDays: z.number().describe('The lead time in days for reordering the product.'),
});
export type AnalyzeReorderingRequirementsInput = z.infer<typeof AnalyzeReorderingRequirementsInputSchema>;

const AnalyzeReorderingRequirementsOutputSchema = z.object({
  reorderQuantity: z.number().describe('The suggested reorder quantity for the product.'),
  reasoning: z.string().describe('The reasoning behind the suggested reorder quantity.'),
});
export type AnalyzeReorderingRequirementsOutput = z.infer<typeof AnalyzeReorderingRequirementsOutputSchema>;

export async function analyzeReorderingRequirements(input: AnalyzeReorderingRequirementsInput): Promise<AnalyzeReorderingRequirementsOutput> {
  return analyzeReorderingRequirementsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeReorderingRequirementsPrompt',
  input: {schema: AnalyzeReorderingRequirementsInputSchema},
  output: {schema: AnalyzeReorderingRequirementsOutputSchema},
  prompt: `You are an inventory management expert. Analyze the provided data and suggest an optimal reordering quantity for the product.

Product ID: {{productId}}
Current Stock Level: {{currentStockLevel}}
Historical Sales Data: {{historicalSalesData}}
Lead Time (Days): {{leadTimeDays}}

Consider the current stock level, historical sales data, and lead time to determine the reorder quantity. Provide a clear reasoning for your suggestion.
`,
});

const analyzeReorderingRequirementsFlow = ai.defineFlow(
  {
    name: 'analyzeReorderingRequirementsFlow',
    inputSchema: AnalyzeReorderingRequirementsInputSchema,
    outputSchema: AnalyzeReorderingRequirementsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
