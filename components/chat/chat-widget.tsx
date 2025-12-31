"use client";

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/contexts/chat-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, User, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export function ChatWidget() {
    const { messages, sendMessage, isOpen, setIsOpen, unreadCount, isLoading } = useChat();
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Get current user ID for styling own messages
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setCurrentUserId(data.user.id);
        });
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        await sendMessage(inputValue);
        setInputValue("");
    };

    if (isLoading) return null; // Don't show until loaded

    return (
        <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Window - Enable pointer events for content */}
            {isOpen && (
                <Card className="w-[calc(100vw-48px)] sm:w-96 shadow-2xl border-primary/20 animate-in slide-in-from-bottom-10 fade-in duration-200 flex flex-col h-[80vh] sm:h-[550px] pointer-events-auto rounded-3xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/30 rounded-t-3xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                                <MessageCircle className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-sm font-bold leading-none">Soporte en Vivo</CardTitle>
                                <CardDescription className="text-xs mt-1">Chat Global de Equipo</CardDescription>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/5">
                        <ScrollArea className="h-full px-4 py-4">
                            <div className="flex flex-col gap-4">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-10 opacity-50">
                                        <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
                                        <div className="text-sm text-muted-foreground">
                                            <p>No hay mensajes aún.</p>
                                            <p>¡Sé el primero en escribir!</p>
                                        </div>
                                    </div>
                                )}

                                {messages.map((msg, index) => {
                                    const isMe = msg.user_id === currentUserId;
                                    const isAdmin = msg.is_admin;
                                    // Check if previous message was from same user to group visually
                                    const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "flex flex-col max-w-[85%] space-y-1 animate-in slide-in-from-bottom-2 duration-300",
                                                isMe ? "self-end items-end" : "self-start items-start",
                                                isSequence ? "mt-0" : "mt-2"
                                            )}
                                        >
                                            {!isSequence && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 select-none">
                                                    {isAdmin ? <ShieldAlert className="h-3 w-3 text-amber-500" /> : <User className="h-3 w-3" />}
                                                    <span className="font-medium">{isMe ? 'Tú' : (msg.user_email?.split('@')[0] || 'Usuario')}</span>
                                                    <span>•</span>
                                                    <span className="opacity-70">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}

                                            <div
                                                className={cn(
                                                    "px-4 py-2.5 rounded-2xl text-sm shadow-sm break-words relative leading-relaxed",
                                                    isMe
                                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                        : "bg-white dark:bg-muted border border-border/50 rounded-tl-sm"
                                                )}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-3 border-t bg-background/50 backdrop-blur rounded-b-3xl">
                        <form onSubmit={handleSend} className="flex w-full items-center gap-2">
                            <Input
                                placeholder="Escribe tu mensaje..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1 rounded-full border-primary/20 focus-visible:ring-primary/20 bg-background/50"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!inputValue.trim()}
                                className="h-10 w-10 rounded-full shadow-md shrink-0 transition-transform active:scale-95"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            {/* Toggle Button - Enable pointer events */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    size="icon"
                    className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto relative group overflow-visible"
                    aria-label="Abrir chat de soporte"
                >
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <MessageCircle className="h-7 w-7 relative z-10" />

                    {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white border-[3px] border-background animate-bounce shadow-sm z-20">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            )}
        </div>
    );
}
