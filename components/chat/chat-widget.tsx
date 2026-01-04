"use client";

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useChat } from '@/contexts/chat-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, User, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useChatPush } from '@/lib/chat/use-chat-push';

export function ChatWidget() {
    const { messages, sendMessage, isOpen, setIsOpen, unreadCount, isLoading, hasMore, loadMore, onlineUsers, typingUsers, handleTypingInput } = useChat();
    const { subscribeToPush, isSubscribed } = useChatPush();
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null); // Bottom ref
    const topRef = useRef<HTMLDivElement>(null);    // Top ref (sentinel)
    const scrollAreaViewportRef = useRef<HTMLDivElement | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Track previous height for scroll preservation
    const prevScrollHeightRef = useRef(0);
    const isFirstLoadRef = useRef(true);

    // Get current user ID
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }: any) => {
            if (data.user) setCurrentUserId(data.user.id);
        });
    }, []);

    // Find the viewport element for scroll manipulation
    useEffect(() => {
        if (isOpen) {
            // Need a slight delay or retry to ensure DOM is ready
            const timer = setTimeout(() => {
                const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
                if (viewport) {
                    scrollAreaViewportRef.current = viewport;
                    // Initial scroll to bottom on open
                    viewport.scrollTop = viewport.scrollHeight;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasMore && !isLoading) {
                // Capture current scroll height before loading more
                if (scrollAreaViewportRef.current) {
                    prevScrollHeightRef.current = scrollAreaViewportRef.current.scrollHeight;
                }
                loadMore();
            }
        }, { rootMargin: '20px' });

        if (topRef.current) observer.observe(topRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoading, loadMore]);

    // Handle Scroll Position and Auto-scroll
    useLayoutEffect(() => {
        if (!scrollAreaViewportRef.current) return;

        const viewport = scrollAreaViewportRef.current;
        const currentScrollHeight = viewport.scrollHeight;

        if (isFirstLoadRef.current) {
            // First load: scroll to bottom
            viewport.scrollTop = currentScrollHeight;
            isFirstLoadRef.current = false;
        } else if (prevScrollHeightRef.current > 0 && currentScrollHeight > prevScrollHeightRef.current) {
            // Loaded more messages (at top): restore scroll position
            // Verify if we were essentially at the top (loading triggered)
            // If the diff is positive, it means content added.
            // We want to scroll DOWN by the amount added to keep the user looking at the same point.
            const diff = currentScrollHeight - prevScrollHeightRef.current;
            viewport.scrollTop = diff; // Jump to where the previous top was
            prevScrollHeightRef.current = 0;
        } else {
            // Standard new message (at bottom) logic
            // Only scroll to bottom if we were already near bottom OR it's my message
            const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
            const lastMessage = messages[messages.length - 1];
            const isMe = lastMessage?.user_id === currentUserId;

            if (isNearBottom || isMe) {
                viewport.scrollTop = currentScrollHeight;
            }
        }
    }, [messages, currentUserId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        setIsSending(true);
        try {
            await sendMessage(inputValue);
            setInputValue("");
            // Force scroll to bottom handled by effect
        } catch (error) {
            // Error handling usually in context/toast
        } finally {
            setIsSending(false);
        }
    };

    // Don't render anything if initializing (optional, maybe showing badge is better?)
    // But existing code returned null if isLoading. We'll stick to that but maybe allow if we have messages.
    if (isLoading && messages.length === 0 && !isOpen) return null;

    return (
        <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <Card className="w-[calc(100vw-48px)] sm:w-96 shadow-2xl border-primary/20 animate-in slide-in-from-bottom-10 fade-in duration-200 flex flex-col h-[80vh] sm:h-[550px] pointer-events-auto rounded-3xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/30 rounded-t-3xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                                <MessageCircle className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-sm font-bold leading-none">Soporte en Vivo</CardTitle>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <CardDescription className="text-xs">
                                        {onlineUsers.length} en línea
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {!isSubscribed && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors animate-pulse"
                                    onClick={subscribeToPush}
                                    title="Activar notificaciones push"
                                >
                                    <span className="sr-only">Activar notificaciones</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell-plus"><path d="M19.3 14.8C20.1 16.4 21 17 21 17H3s3-2 3-9c0-3.3 2.7-6 6-6 1 0 1.9.2 2.8.7" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M15 8h6" /><path d="M18 5v6" /></svg>
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/5">
                        <ScrollArea className="h-full px-4 py-4" type="always">
                            <div className="flex flex-col gap-4 min-h-full justify-end">
                                {/* Loading More Spinner */}
                                {hasMore && (
                                    <div ref={topRef} className="flex justify-center py-2">
                                        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                )}

                                {messages.length === 0 && !isLoading && (
                                    <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3 opacity-50">
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

                    <CardFooter className="p-3 border-t bg-background/50 backdrop-blur rounded-b-3xl flex-col gap-2 items-stretch">
                        {typingUsers.length > 0 && (
                            <div className="text-[10px] text-muted-foreground animate-pulse px-2 flex items-center gap-1">
                                <span className="font-medium">
                                    {typingUsers.map(u => u.email.split('@')[0]).join(', ')}
                                </span>
                                <span>está(n) escribiendo...</span>
                            </div>
                        )}
                        <form onSubmit={handleSend} className="flex w-full items-center gap-2">
                            <Input
                                placeholder="Escribe tu mensaje..."
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    handleTypingInput();
                                }}
                                className="flex-1 rounded-full border-primary/20 focus-visible:ring-primary/20 bg-background/50"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!inputValue.trim() || isSending}
                                className="h-10 w-10 rounded-full shadow-md shrink-0 transition-transform active:scale-95"
                            >
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            {/* Toggle Button */}
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
