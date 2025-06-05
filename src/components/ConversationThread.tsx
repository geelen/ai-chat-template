import React, { useState, useEffect, FormEvent } from 'react'
import { storeName } from '../consts'
import '../styles/scrollbar.css'
import '../styles/github.css'
import { type Conversation, type Message } from '../types'
import { type Model } from '../types/models'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { useAutoscroll } from '../hooks/useAutoscroll'
import { useStreamResponse } from '../hooks/useStreamResponse'
import { setApiKey } from '../utils/apiKeys'
import ApiKeyModal from './ApiKeyModal'

interface ConversationThreadProps {
  conversations: Conversation[]
  conversationId?: number
  setConversationId: (id: number) => void
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
  db: any
  selectedModel: Model
  onApiKeyUpdate: () => void
}

const ConversationThread: React.FC<ConversationThreadProps> = ({
  conversations,
  conversationId,
  setConversationId,
  setConversations,
  db,
  selectedModel,
  onApiKeyUpdate,
}) => {
  const [input, setInput] = useState<string>('')
  const [apiKeyModal, setApiKeyModal] = useState<{ isOpen: boolean; model: Model | null }>({
    isOpen: false,
    model: null,
  })

  const { messagesEndRef, messagesContainerRef, scrollToBottom } = useAutoscroll()

  const handleApiKeyRequired = async (model: Model): Promise<boolean> => {
    return new Promise((resolve) => {
      setApiKeyModal({
        isOpen: true,
        model,
      })

      // Store the resolve function to call when modal is closed
      window.apiKeyModalResolve = resolve
    })
  }

  const handleApiKeySave = (apiKey: string) => {
    if (apiKeyModal.model) {
      setApiKey(apiKeyModal.model.provider.id, apiKey)
      setApiKeyModal({ isOpen: false, model: null })
      // Notify parent that API key was updated
      onApiKeyUpdate()
      // Resolve the promise to continue with the request
      if (window.apiKeyModalResolve) {
        window.apiKeyModalResolve(true)
        delete window.apiKeyModalResolve
      }
    }
  }

  const handleApiKeyCancel = () => {
    setApiKeyModal({ isOpen: false, model: null })
    // Resolve the promise with false to cancel the request
    if (window.apiKeyModalResolve) {
      window.apiKeyModalResolve(false)
      delete window.apiKeyModalResolve
    }
  }

  const { isLoading, setIsLoading, streamStarted, controller, streamResponse, aiResponseRef } = useStreamResponse({
    conversationId,
    setConversations,
    scrollToBottom,
    selectedModel,
    onApiKeyRequired: handleApiKeyRequired,
  })

  const currentConversation = conversations.find((conv) => conv.id === conversationId) || { messages: [], title: '' }

  //when new message chunks are streamed in, scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [aiResponseRef.current])

  //when conversation changes, scroll to bottom
  useEffect(scrollToBottom, [conversationId])

  //when conversation changes, reset input
  useEffect(() => {
    setInput('')
  }, [conversationId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (currentConversation.messages.length === 0) {
      setConversations((prev) => {
        const updated = [...prev]
        updated.unshift({
          id: conversationId,
          title: 'New conversation',
          messages: [],
        })
        return updated
      })
    }

    const userMessage: Message = { role: 'user', content: input }

    setInput('')
    setIsLoading(true)

    setConversations((prev) => {
      const updated = [...prev]
      const conv = updated.find((c) => c.id === conversationId)
      if (conv) {
        conv.messages.push(userMessage)
      }
      return updated
    })

    await streamResponse([...currentConversation.messages, userMessage])

    setIsLoading(false)
  }

  const storeMessages = async () => {
    if (!currentConversation.messages || currentConversation.messages.length === 0) {
      return
    }

    const store = db.transaction(storeName, 'readwrite').objectStore(storeName)
    const objectData = {
      id: conversationId,
      title: currentConversation.title,
      messages: currentConversation.messages,
    }
    const value = await store.put(objectData)
    setConversationId(value)
  }

  useEffect(() => {
    if (db && conversationId) {
      storeMessages()
    }
  }, [conversations])

  console.log({ currentConversation })

  return (
    <div className={`flex flex-col h-[calc(100%-3rem)] w-full ${currentConversation.messages.length === 0 ? 'justify-center' : ''}`}>
      <div
        ref={messagesContainerRef}
        className={`
        overflow-x-hidden
        ${currentConversation.messages.length === 0 ? 'flex items-center justify-center pb-6' : 'flex-1 overflow-y-scroll'}`}
      >
        <div className="max-w-2xl mx-auto w-full px-4">
          {currentConversation.messages.length === 0 ? (
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-zinc-800">What do you want to know?</h1>
              <div className="mt-4">
                <h2 className="mt-2 text-md opacity-70">
                  AI chat template built with React, Vite and Cloudflare Workers AI.
                  <div className="mt-1 w-full">
                    Find the source code on{' '}
                    <a className="text-blue-700" href="https://github.com/thomasgauvin/ai-chat-template">
                      GitHub
                    </a>
                    .
                  </div>
                </h2>
              </div>
            </div>
          ) : (
            <div className="py-4 px-4 space-y-4">
              {currentConversation.messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
              {isLoading && !streamStarted && <div className="text-center text-sm text-zinc-600">Thinking...</div>}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className={`p-4 ${currentConversation.messages.length === 0 ? 'pb-35' : ''}`}>
        <div className="max-w-2xl mx-auto">
          <ChatInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            streamStarted={streamStarted}
            controller={controller}
            messagesCount={currentConversation.messages.length}
          />
        </div>
      </div>

      <ApiKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={handleApiKeyCancel}
        provider={apiKeyModal.model?.provider!}
        onSave={handleApiKeySave}
      />
    </div>
  )
}

export default ConversationThread
