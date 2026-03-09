"use client";

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useChat } from '@/contexts/chat-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useChatPush } from '@/lib/chat/use-chat-push';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    MessageCircle, X, Send, User, ShieldAlert, Loader2, 
    Image as ImageIcon, Paperclip, MoreVertical, Pencil, Trash2, ChevronDown, ChevronLeft 
} from 'lucide-react';
import { useConversations } from '@/lib/chat/use-conversations';

export function ChatWidget() {
    const { 
        messages, 
        sendMessage, 
        isOpen, 
        setIsOpen, 
        unreadCount, 
        isLoading, 
        hasMore, 
        loadMore, 
        onlineUsers, 
        typingUsers, 
        handleTypingInput,
        uploadMedia,
        editMessage,
        deleteMessage,
        activeConversationId,
        setActiveConversationId,
        currentUser
    } = useChat();
    const { subscribeToPush, isSubscribed } = useChatPush();
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null); // Bottom ref
    const topRef = useRef<HTMLDivElement>(null);    // Top ref (sentinel)
    const scrollAreaViewportRef = useRef<HTMLDivElement | null>(null);
    
    // Add conversations hook
    const { conversations: convList, isLoading: isConvLoading, startDirectConversation } = useConversations(currentUser);

    const [isSending, setIsSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    // Track previous height for scroll preservation
    const prevScrollHeightRef = useRef(0);
    const isFirstLoadRef = useRef(true);

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
            const isMe = lastMessage?.user_id === currentUser?.id;

            if (isNearBottom || isMe) {
                viewport.scrollTop = currentScrollHeight;
            }
        }
    }, [messages, currentUser]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() && !selectedFile) return;

        setIsSending(true);
        try {
            let mediaUrl = undefined;
            let messageType: 'text' | 'image' = 'text';

            if (selectedFile) {
                mediaUrl = await uploadMedia(selectedFile);
                messageType = 'image';
            }

            // If we have text AND an image, we send the image with the text as caption
            // (Our sendMessage supports content and mediaUrl in one message)
            await sendMessage(inputValue, mediaUrl, messageType);
            
            setInputValue("");
            setSelectedFile(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleEditStart = (msg: any) => {
        setEditingId(msg.id);
        setEditValue(msg.content);
    };

    const handleEditSave = async () => {
        if (!editingId || !editValue.trim()) return;
        try {
            await editMessage(editingId, editValue);
            setEditingId(null);
            setEditValue("");
        } catch (error) {
            console.error("Error saving edit:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de que quieres eliminar este mensaje?")) {
            try {
                await deleteMessage(id);
            } catch (error) {
                console.error("Error deleting message:", error);
            }
        }
    };

    // Don't render anything if initializing (optional, maybe showing badge is better?)
    // But existing code returned null if isLoading. We'll stick to that but maybe allow if we have messages.
    const handleOpenDm = async (userId: string) => {
        const convId = await startDirectConversation(userId);
        if (convId) {
            setActiveConversationId(convId);
        }
    };

    // Determine the title of the active conversation
    let activeConvTitle = "Mensaje Directo";
    const activeConv = convList.find((c: any) => c.id === activeConversationId);
    if (activeConv) {
        if (activeConv.type === 'global') {
            activeConvTitle = "Chat Global / Soporte";
        } else {
            const otherUserId = activeConv.participants?.find((p: any) => p.user_id !== currentUser?.id)?.user_id;
            const otherOnlineUser = onlineUsers.find(u => u.user_id === otherUserId);
            if (otherOnlineUser) {
                activeConvTitle = otherOnlineUser.email.split('@')[0];
            } else {
                activeConvTitle = "Usuario Desconectado";
            }
        }
    }

    return (
        <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Main Chat Window */}
            <div className={cn(
                "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] origin-bottom-right pointer-events-auto",
                isOpen 
                    ? "scale-100 opacity-100 translate-y-0" 
                    : "scale-95 opacity-0 translate-y-8 pointer-events-none"
            )}>
                <Card className="w-[90vw] md:w-[400px] h-[600px] shadow-2xl flex flex-col overflow-hidden border-border/40 bg-background/85 dark:bg-background/60 backdrop-blur-xl rounded-[2rem]">
                    <CardHeader className="p-5 bg-zinc-950 dark:bg-zinc-900/90 text-zinc-50 shrink-0 border-b border-white/10 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {activeConversationId ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setActiveConversationId(null)}
                                        className="h-8 w-8 rounded-xl hover:bg-white/10 text-zinc-300 transition-all mr-1"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                ) : (
                                    <div className="relative">
                                        <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                                            <MessageCircle className="h-5 w-5" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-emerald-500 rounded-full border-2 border-primary flex items-center justify-center">
                                            <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <CardTitle className="text-lg font-bold tracking-tight capitalize">
                                        {activeConversationId ? activeConvTitle : "Luxor Inbox"}
                                    </CardTitle>
                                    <CardDescription className="text-zinc-300 text-[10px] flex items-center gap-1.5">
                                        <span className="inline-flex h-1 w-1 rounded-full bg-emerald-400" />
                                        {onlineUsers.length} en línea
                                    </CardDescription>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                                className="h-9 w-9 rounded-2xl hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-90"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/5">
                        {!activeConversationId ? (
                            <ScrollArea className="h-full px-4 py-4" type="always">
                                {/* Usuarios En Linea Recientes para DM */}
                                <div className="mb-4">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Disponibles</h3>
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                        {onlineUsers.filter(u => u.user_id !== currentUser?.id).map(user => (
                                            <div key={user.user_id} className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group" onClick={() => handleOpenDm(user.user_id)}>
                                                <div className="relative h-12 w-12 rounded-full bg-primary/10 border-2 border-transparent group-hover:border-primary transition-all flex items-center justify-center shadow-sm">
                                                    <span className="text-sm font-bold text-primary">{user.email.substring(0,2).toUpperCase()}</span>
                                                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground font-medium truncate w-14 text-center">{user.email.split('@')[0]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Inbox List */}
                                <div className="space-y-1">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Conversaciones</h3>
                                    {isConvLoading ? (
                                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                                    ) : convList.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-muted-foreground">Inicia una conversación arriba.</div>
                                    ) : (
                                        convList.map((conv: any) => {
                                            const isGlobal = conv.type === 'global';
                                            let convTitle = 'Conversación Privada';
                                            let convIcon = <User className="h-5 w-5" />;
                                            
                                            if (isGlobal) {
                                                convTitle = 'Chat Global / Soporte';
                                                convIcon = <ShieldAlert className="h-5 w-5" />;
                                            } else {
                                                const otherUserId = conv.participants?.find((p: any) => p.user_id !== currentUser?.id)?.user_id;
                                                const otherOnlineUser = onlineUsers.find((u: any) => u.user_id === otherUserId);
                                                
                                                if (otherOnlineUser) {
                                                    convTitle = otherOnlineUser.email.split('@')[0];
                                                } else if (otherUserId) {
                                                    convTitle = "Usuario (Desconectado)"; 
                                                    // TODO: Fetch user email from DB if offline. For now, it shows disconnected.
                                                }
                                            }

                                            return (
                                                <div 
                                                    key={conv.id} 
                                                    onClick={() => setActiveConversationId(conv.id)}
                                                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 cursor-pointer transition-all active:scale-[0.98]"
                                                >
                                                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center shrink-0 capitalize font-bold", isGlobal ? "bg-zinc-900 text-zinc-50" : "bg-primary/10 text-primary")}>
                                                        {!isGlobal && convTitle !== "Usuario (Desconectado)" ? convTitle.substring(0,2) : convIcon}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <h4 className="text-sm font-semibold truncate capitalize">{convTitle}</h4>
                                                        <p className="text-xs text-muted-foreground truncate opacity-80">Pulsa para ver mensajes...</p>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        ) : (
                            <ScrollArea className="h-full px-4 py-4" type="always">
                            <div className="flex flex-col gap-4 min-h-full justify-end pb-2">
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
                                    const isMe = msg.user_id === currentUser?.id;
                                    const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id;
                                    const nextMsgIsSequence = index < messages.length - 1 && messages[index + 1].user_id === msg.user_id;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "flex flex-col gap-1.5 max-w-[85%] group relative",
                                                isMe ? "self-end items-end" : "self-start items-start",
                                                isSequence ? "mt-0.5" : "mt-4"
                                            )}
                                        >
                                            {!isSequence && (
                                                <span className="text-[10px] font-semibold text-muted-foreground/80 mb-0.5 px-1 tracking-wide">
                                                    {msg.user_email.split('@')[0]}
                                                </span>
                                            )}

                                            <div
                                                className={cn(
                                                    "py-2.5 rounded-[1.25rem] text-sm shadow-sm break-words relative leading-relaxed transition-all duration-200 min-w-[60px]",
                                                    msg.deleted_at ? "px-3" : (isMe ? "pl-4 pr-10" : "px-4"),
                                                    msg.deleted_at 
                                                        ? "bg-muted/40 border border-border/30 text-muted-foreground italic rounded-2xl" 
                                                        : (isMe
                                                            ? "bg-zinc-900 dark:bg-zinc-800 text-zinc-50 shadow-sm"
                                                            : "bg-background/95 border border-border/40 text-foreground shadow-sm"),
                                                    !msg.deleted_at && isMe && !isSequence && !nextMsgIsSequence ? "rounded-tr-none" : "",
                                                    !msg.deleted_at && !isMe && !isSequence && !nextMsgIsSequence ? "rounded-tl-none" : "",
                                                    !msg.deleted_at && isSequence ? (isMe ? "rounded-tr-md" : "rounded-tl-md") : "",
                                                )}
                                            >
                                                {/* Action Menu */}
                                                {isMe && !msg.deleted_at && (
                                                    <div className="absolute top-1.5 right-1.5 z-10">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 rounded-full bg-black/15 hover:bg-black/30 text-white shadow-sm ring-1 ring-white/20 transition-all active:scale-95"
                                                                >
                                                                    <ChevronDown className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-32 bg-popover/90 backdrop-blur-md border-white/10 rounded-xl">
                                                                <DropdownMenuItem onClick={() => handleEditStart(msg)} className="cursor-pointer gap-2">
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Editar</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem 
                                                                    onClick={() => handleDelete(msg.id)} 
                                                                    className="cursor-pointer text-destructive focus:text-destructive gap-2"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Eliminar</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )}

                                                {msg.deleted_at ? (
                                                    <div className="flex items-center gap-2 py-0.5 px-1">
                                                        <div className="h-5 w-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                                                            <ShieldAlert className="h-3 w-3 opacity-70" />
                                                        </div>
                                                        <span className="text-[11px] font-medium opacity-80">Este mensaje fue eliminado</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {msg.message_type === 'image' && msg.media_url && (
                                                            <div className="mb-2 -mx-2 -mt-1 overflow-hidden rounded-xl border border-black/5 bg-black/5 shadow-inner">
                                                                <img 
                                                                    src={msg.media_url} 
                                                                    alt="Chat attachment" 
                                                                    className="max-w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-500 cursor-zoom-in"
                                                                    onClick={() => window.open(msg.media_url, '_blank')}
                                                                />
                                                            </div>
                                                        )}

                                                        {editingId === msg.id ? (
                                                            <div className="flex flex-col gap-2 min-w-[150px] py-1 text-inherit">
                                                                <textarea 
                                                                    className="bg-white/10 rounded-lg p-2 outline-none resize-none w-full text-inherit ring-1 ring-white/20 focus:ring-white/40 placeholder:text-inherit/50"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    autoFocus
                                                                    rows={2}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleEditSave();
                                                                        }
                                                                        if (e.key === 'Escape') setEditingId(null);
                                                                    }}
                                                                />
                                                                <div className="flex justify-end gap-3 px-1 text-inherit">
                                                                    <button onClick={() => setEditingId(null)} className="text-[11px] opacity-70 hover:opacity-100 transition-opacity">Cancelar</button>
                                                                    <button onClick={handleEditSave} className="text-[11px] font-bold underline decoration-2 underline-offset-4">Guardar</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="whitespace-pre-wrap">{msg.content}</span>
                                                                {msg.is_edited && (
                                                                    <span className="text-[8px] opacity-40 ml-1.5 font-medium tracking-tight uppercase">Editado</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {isMe && (
                                                    <div className="flex justify-end mt-1 -mr-1">
                                                        <div className={cn(
                                                            "text-[9px] flex items-center",
                                                            msg.is_read ? "text-blue-400" : "text-zinc-50/50"
                                                        )}>
                                                            {msg.is_read ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-check"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>

                    <CardFooter className="p-4 border-t border-border/20 bg-background/40 dark:bg-background/20 backdrop-blur-md flex-col gap-3 items-stretch shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                        {!activeConversationId ? (
                            <div className="text-center py-2">
                                <span className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                                    <ShieldAlert className="h-3 w-3" />
                                    Selecciona una sala para escribir
                                </span>
                            </div>
                        ) : (
                        <>
                        {typingUsers.length > 0 && (
                            <div className="text-[10px] text-muted-foreground/80 px-2 flex items-center gap-2">
                                <div className="flex gap-0.5">
                                    <div className="h-1 w-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="h-1 w-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="h-1 w-1 bg-zinc-500 rounded-full animate-bounce" />
                                </div>
                                <span className="font-medium italic">
                                    {typingUsers[0].email.split('@')[0]} {typingUsers.length > 1 ? `y ${typingUsers.length - 1} más` : ''} está escribiendo...
                                </span>
                            </div>
                        )}
                        
                        {previewUrl && (
                            <div className="relative w-20 h-20 mb-1 ml-1 rounded-2xl border-2 border-primary/20 bg-muted overflow-hidden group shadow-md animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <button 
                                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                    className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                    <X className="h-6 w-6 text-foreground" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSend} className="flex w-full items-center gap-2.5">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileSelect} 
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl shrink-0 bg-muted/50 hover:bg-muted text-foreground/70 hover:text-foreground transition-all active:scale-90"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Input
                                placeholder="Escribe un mensaje..."
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    handleTypingInput();
                                }}
                                className="flex-1 h-11 rounded-2xl border-border/50 bg-background/60 focus-visible:ring-primary/30 focus-visible:ring-offset-0 px-4 placeholder:text-muted-foreground/60 transition-all shadow-sm"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={(!inputValue.trim() && !selectedFile) || isSending}
                                className="h-11 w-11 rounded-2xl shadow-md shrink-0 transition-all active:scale-90 bg-zinc-900 dark:bg-zinc-800 text-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-700 disabled:grayscale disabled:opacity-50"
                            >
                                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </Button>
                        </form>
                        </>
                        )}
                    </CardFooter>
                </Card>
            </div>

            {/* Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    size="icon"
                    className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-zinc-900 dark:bg-zinc-800 text-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto relative group overflow-visible"
                    aria-label="Abrir chat de soporte"
                >
                    <div className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
