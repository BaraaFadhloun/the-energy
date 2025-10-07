"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Sparkles } from "lucide-react"
import { useRef, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Header } from "@/components/header"
import { sendChatMessage } from "@/lib/api-client"
import { useLanguage } from "@/context/language-context"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/context/auth-context"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  parts: Array<{ type: "text"; text: string }>
}

const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="text-lg font-semibold text-foreground/90 mb-3 mt-2">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-base font-semibold text-foreground/90 mb-2 mt-2">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-foreground/90 mb-2 mt-2">{children}</h3>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 last:mb-0 list-disc space-y-1 pl-5 text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 last:mb-0 list-decimal space-y-1 pl-5 text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  em: ({ children }) => <em className="text-foreground/80">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground/90">{children}</code>
  ),
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { t } = useLanguage()
  const copy = t<any>("chatPage")
  const { accessToken } = useAuth()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    if (!accessToken) {
      setErrorMessage(copy.errorPrefix + copy.authRequired)
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${generateId()}`,
      role: "user",
      parts: [{ type: "text", text: trimmed }],
    }

    setErrorMessage(null)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setPendingPrompt(trimmed)
    setIsThinking(true)

    try {
      const historyPayload = nextMessages.map((message) => ({
        role: message.role,
        content: message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n"),
      }))

      const response = await sendChatMessage(trimmed, historyPayload, accessToken)

      const assistantMessage: ChatMessage = {
        id: response.id || `assistant-${generateId()}`,
        role: "assistant",
        parts: [{ type: "text", text: response.content }],
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const fallback = error instanceof Error ? error.message : ""
      const composed = `${copy.errorPrefix}${fallback}`
      setErrorMessage(composed)

      const assistantMessage: ChatMessage = {
        id: `assistant-${generateId()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: composed,
          },
        ],
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setPendingPrompt(null)
      setIsThinking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = inputRef.current?.value ?? ""
    void submitPrompt(value)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const suggestedQuestions = copy.suggestions as string[]

  const placeholderAssistantMessage = useMemo(
    () => ({
      id: "assistant-placeholder",
      role: "assistant" as const,
      parts: [
        {
          type: "text" as const,
          text: copy.placeholderAnalyzing(pendingPrompt),
        },
      ],
    }),
    [pendingPrompt, copy],
  )

  const displayedMessages = useMemo(() => {
    if (isThinking) {
      return [...messages, placeholderAssistantMessage]
    }
    return messages
  }, [isThinking, messages, placeholderAssistantMessage])

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col"
    >
      <Header />
      <AuthGuard>
        <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto py-12">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-3xl border border-border/40 bg-card/95 shadow-xl backdrop-blur-sm overflow-hidden md:h-[70vh] flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 px-6 py-6 sm:px-8">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">{copy.title}</h2>
                  <p className="text-sm text-muted-foreground sm:text-base">{copy.subtitle}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                    isThinking ? "bg-primary/15 text-primary" : "bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isThinking ? "bg-primary animate-pulse" : "bg-muted-foreground/50"
                    }`}
                  />
                  {isThinking ? copy.statusWorking : copy.statusReady}
                </span>
              </div>
              {messages.length === 0 ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="flex min-h-full flex-col items-center justify-center gap-10 px-8 py-20 text-center">
                    <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/30 to-primary/30 shadow-inner">
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-3xl font-bold text-foreground">{copy.suggestionsTitle}</h3>
                      <p className="mx-auto max-w-xl text-base text-muted-foreground leading-relaxed">
                        {copy.suggestionsDescription}
                      </p>
                    </div>
                    <div className="grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          disabled={isThinking}
                          onClick={() => void submitPrompt(question)}
                          className="group rounded-2xl border border-border/60 bg-background/60 p-5 text-left transition-all hover:-translate-y-1 hover:border-primary/60 hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-60"
                        >
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {question}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-8 space-y-6">
                  {displayedMessages.map((message) => {
                    const isUser = message.role === "user"
                    const isPlaceholder = message.id === "assistant-placeholder"

                    return (
                      <div
                        key={message.id}
                        className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {!isUser && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-primary/30 shadow-sm">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[70%] md:max-w-[60%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm transition-colors ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-card/95 border border-border/40 text-foreground"
                          } ${isPlaceholder ? "opacity-90" : ""}`}
                        >
                          {message.parts.map((part, index) => {
                            if (part.type === "text") {
                              if (isUser || isPlaceholder) {
                                return (
                                  <p
                                    key={index}
                                    className={`whitespace-pre-wrap text-pretty ${
                                      isPlaceholder ? "italic text-muted-foreground" : ""
                                    }`}
                                  >
                                    {part.text}
                                  </p>
                                )
                              }

                              return (
                                <ReactMarkdown
                                  key={index}
                                  className="space-y-3 text-pretty text-sm leading-relaxed"
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents}
                                >
                                  {part.text}
                                </ReactMarkdown>
                              )
                            }
                            return null
                          })}
                          {isPlaceholder && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                              <span>{copy.placeholderHint}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto py-6 max-w-4xl px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                ref={inputRef}
                placeholder={copy.inputPlaceholder}
                disabled={isThinking}
                className="flex-1 h-14 rounded-full border border-border/40 bg-card/90 px-6 text-base shadow focus-visible:border-primary focus-visible:ring-primary/40"
              />
              <Button
                type="submit"
                disabled={isThinking}
                size="icon"
                className="h-14 w-full shrink-0 rounded-full bg-primary shadow-lg transition-transform hover:-translate-y-0.5 sm:w-14"
                aria-label={copy.inputButton}
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
        {errorMessage && (
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 pb-6">
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          </div>
        )}
        </div>
      </AuthGuard>
    </div>
  )
}
