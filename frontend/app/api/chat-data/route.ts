import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  // System context about the energy data
  const systemContext = `You are an AI assistant helping users understand their energy consumption data.
  
Current energy data context:
- Total consumption: 450 kWh this month
- Total cost: €13,500 (€30/kWh rate)
- CO₂ emissions: 225 kg
- Peak usage: 3.2 kW
- Usage patterns show highest consumption during evening hours (6-10 PM)
- Main energy consumers: Air conditioning (40%), Heating (25%), Appliances (20%), Lighting (15%)
- Recent trend shows 15% increase compared to last month

You should:
- Answer questions about energy consumption, costs, and patterns
- Provide actionable recommendations for reducing energy usage
- Explain CO₂ impact and environmental considerations
- Suggest optimal usage times and energy-saving strategies
- Be conversational and helpful`

  const prompt = convertToModelMessages([
    {
      id: "system",
      role: "system",
      parts: [{ type: "text", text: systemContext }],
    },
    ...messages,
  ])

  const result = streamText({
    model: "openai/gpt-5-mini",
    prompt,
    abortSignal: req.signal,
    maxOutputTokens: 1000,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      if (isAborted) {
        console.log("[v0] Chat aborted")
      }
    },
    consumeSseStream: consumeStream,
  })
}
