"use client";

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useChat } from '@/contexts/chat-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    MessageCircle, X, Send, User, ShieldAlert, Loader2, 
    Paperclip, MoreVertical, Pencil, Trash2, ChevronDown, ChevronLeft, AlertCircle, RotateCcw, Smile
} from 'lucide-react';
import type { EnrichedConversation } from '@/lib/chat/use-conversations';
import { useToast } from '@/hooks/use-toast';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// Format timestamp for display between message groups
function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHours < 24) return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Check if we should show a timestamp separator between two messages
function shouldShowTimestamp(prev: string | null, current: string): boolean {
    if (!prev) return true;
    return new Date(current).getTime() - new Date(prev).getTime() > 5 * 60 * 1000; // 5 min gap
}

export function ChatWidget() {
    const { 
        messages, 
        sendMessage,
        retryMessage,
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
        currentUser,
        convList,
        isConvLoading,
        startDirectConversation,
    } = useChat();
    const { error: toastError } = useToast();
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollAreaViewportRef = useRef<HTMLDivElement | null>(null);

    const [isSending, setIsSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [showEmoji, setShowEmoji] = useState(false);

    // Track previous height for scroll preservation
    const prevScrollHeightRef = useRef(0);
    const isFirstLoadRef = useRef(true);
    const isLoadingMoreRef = useRef(false);

    // Find the viewport element and scroll to bottom instantly on open
    useEffect(() => {
        if (isOpen && activeConversationId) {
            isFirstLoadRef.current = true;
            // Use rAF to ensure DOM is painted before scrolling
            const raf = requestAnimationFrame(() => {
                const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
                if (viewport) {
                    scrollAreaViewportRef.current = viewport;
                    viewport.scrollTop = viewport.scrollHeight;
                }
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [isOpen, activeConversationId]);

    // Handle loading more messages (manual button click)
    const handleLoadMore = () => {
        if (!hasMore || isLoading) return;
        if (scrollAreaViewportRef.current) {
            prevScrollHeightRef.current = scrollAreaViewportRef.current.scrollHeight;
            isLoadingMoreRef.current = true;
        }
        loadMore();
    };

    // Handle Scroll Position after messages change
    useLayoutEffect(() => {
        if (!scrollAreaViewportRef.current) return;

        const viewport = scrollAreaViewportRef.current;
        const currentScrollHeight = viewport.scrollHeight;

        if (isFirstLoadRef.current && messages.length > 0) {
            // First load: scroll to bottom instantly
            viewport.scrollTop = currentScrollHeight;
            isFirstLoadRef.current = false;
        } else if (isLoadingMoreRef.current && prevScrollHeightRef.current > 0) {
            // Loaded older messages: preserve scroll position
            const diff = currentScrollHeight - prevScrollHeightRef.current;
            viewport.scrollTop = diff;
            prevScrollHeightRef.current = 0;
            isLoadingMoreRef.current = false;
        } else if (!isLoadingMoreRef.current) {
            // New message arrived at bottom
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

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    setSelectedFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setPreviewUrl(reader.result as string);
                    reader.readAsDataURL(file);
                    e.preventDefault();
                    break;
                }
            }
        }
    };


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputValue.trim() && !selectedFile) || isSending) return;

        setIsSending(true);
        try {
            let mediaUrl = undefined;
            let messageType: 'text' | 'image' = 'text';

            if (selectedFile) {
                mediaUrl = await uploadMedia(selectedFile);
                messageType = 'image';
            }

            await sendMessage(inputValue, mediaUrl, messageType);
            
            setInputValue("");
            setSelectedFile(null);
            setPreviewUrl(null);
        } catch (error: any) {
            toastError('Error', error?.message || 'No se pudo enviar el mensaje.');
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
        setDeleteConfirmId(null);
        try {
            await deleteMessage(id);
        } catch {
            toastError('Error', 'No se pudo eliminar el mensaje.');
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
    const activeConv = convList.find((c: EnrichedConversation) => c.id === activeConversationId);
    if (activeConv) {
        if (activeConv.type === 'global') {
            activeConvTitle = "Chat Global / Soporte";
        } else if (activeConv.other_user_name) {
            activeConvTitle = activeConv.other_user_name;
        } else {
            const otherOnlineUser = onlineUsers.find(u => u.user_id === activeConv.other_user_id);
            activeConvTitle = otherOnlineUser ? otherOnlineUser.email.split('@')[0] : "Usuario";
        }
    }

    return (
        <div className={cn(
            "fixed z-50 pointer-events-none",
            isOpen 
                ? "inset-0 md:inset-auto md:bottom-6 md:right-6 flex flex-col items-end justify-end"
                : "bottom-24 md:bottom-6 right-4 md:right-6 flex flex-col items-end gap-4"
        )}>
            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar mensaje?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El mensaje será eliminado para todos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Main Chat Window */}
            <div className={cn(
                "transition-all duration-500 ease-in-out origin-bottom-right pointer-events-auto",
                isOpen 
                    ? "scale-100 opacity-100 translate-y-0" 
                    : "scale-95 opacity-0 translate-y-8 pointer-events-none"
            )}>
                <Card className="w-screen h-[100dvh] md:w-[400px] md:h-[600px] shadow-2xl flex flex-col overflow-hidden border-border/40 bg-background/85 dark:bg-background/60 backdrop-blur-xl md:rounded-[2rem] rounded-none">
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
                                        {onlineUsers.filter(u => u.user_id !== currentUser?.id && u.email).map(user => (
                                            <div key={user.user_id} className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group" onClick={() => handleOpenDm(user.user_id)}>
                                                <div className="relative h-12 w-12 rounded-full bg-primary/10 border-2 border-transparent group-hover:border-primary transition-all flex items-center justify-center shadow-sm">
                                                    <span className="text-sm font-bold text-primary">{(user.email || '??').substring(0,2).toUpperCase()}</span>
                                                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground font-medium truncate w-14 text-center">{(user.email || 'Usuario').split('@')[0]}</span>
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
                                        convList.map((conv: EnrichedConversation) => {
                                            const isGlobal = conv.type === 'global';
                                            let convTitle = 'Conversación Privada';
                                            let convIcon = <User className="h-5 w-5" />;
                                            const isOtherOnline = conv.other_user_id ? onlineUsers.some(u => u.user_id === conv.other_user_id) : false;
                                            
                                            if (isGlobal) {
                                                convTitle = 'Chat Global / Soporte';
                                                convIcon = <ShieldAlert className="h-5 w-5" />;
                                            } else if (conv.other_user_name) {
                                                convTitle = conv.other_user_name;
                                            } else {
                                                const otherOnlineUser = onlineUsers.find((u: any) => u.user_id === conv.other_user_id);
                                                if (otherOnlineUser) {
                                                    convTitle = otherOnlineUser.email.split('@')[0];
                                                }
                                            }

                                            // Format last message preview
                                            let lastMsgPreview = 'Sin mensajes aún';
                                            let lastMsgTime = '';
                                            if (conv.last_message) {
                                                const sender = conv.last_message.user_email?.split('@')[0] || '';
                                                const isImage = conv.last_message.message_type === 'image';
                                                lastMsgPreview = isImage ? `${sender}: 📷 Imagen` : `${sender}: ${conv.last_message.content}`;
                                                lastMsgTime = formatMessageTime(conv.last_message.created_at);
                                            }
                                            const hasUnread = conv.unread_count > 0;

                                            return (
                                                <div 
                                                    key={conv.id} 
                                                    onClick={() => setActiveConversationId(conv.id)}
                                                    className={cn(
                                                        "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
                                                        hasUnread 
                                                            ? "bg-primary/[0.06] hover:bg-primary/[0.1] border border-primary/10" 
                                                            : "hover:bg-muted/50"
                                                    )}
                                                >
                                                    <div className="relative">
                                                        <div className={cn(
                                                            "h-12 w-12 rounded-full flex items-center justify-center shrink-0 capitalize font-bold text-sm",
                                                            isGlobal ? "bg-zinc-900 text-zinc-50" : "bg-primary/10 text-primary"
                                                        )}>
                                                            {isGlobal ? convIcon : convTitle.substring(0,2).toUpperCase()}
                                                        </div>
                                                        {!isGlobal && isOtherOnline && (
                                                            <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                                                        )}
                                                        {hasUnread && (
                                                            <div className="absolute -top-0.5 -left-0.5 h-3 w-3 bg-blue-500 rounded-full border-2 border-background animate-pulse" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className={cn(
                                                                "text-sm truncate capitalize",
                                                                hasUnread ? "font-bold text-foreground" : "font-semibold"
                                                            )}>{convTitle}</h4>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {lastMsgTime && (
                                                                    <span className={cn(
                                                                        "text-[10px] shrink-0",
                                                                        hasUnread ? "text-blue-400 font-semibold" : "text-muted-foreground/60"
                                                                    )}>{lastMsgTime}</span>
                                                                )}
                                                                {hasUnread && (
                                                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white px-1.5 shadow-sm">
                                                                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className={cn(
                                                            "text-xs truncate mt-0.5",
                                                            hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground opacity-70"
                                                        )}>{lastMsgPreview}</p>
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
                                {/* Load More Button */}
                                {hasMore && (
                                    <div className="flex justify-center py-3">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoading}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground/80 bg-muted/30 hover:bg-muted/50 rounded-full transition-all disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                                            )}
                                            {isLoading ? 'Cargando...' : 'Cargar anteriores'}
                                        </button>
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
                                    const isFailed = msg.id.toString().startsWith('failed-');
                                    const isSequence = index > 0 && messages[index - 1].user_id === msg.user_id && !isFailed;
                                    const nextMsgIsSequence = index < messages.length - 1 && messages[index + 1].user_id === msg.user_id;
                                    const prevTime = index > 0 ? messages[index - 1].created_at : null;
                                    const showTimestamp = shouldShowTimestamp(prevTime, msg.created_at);

                                    return (
                                        <div key={msg.id}>
                                            {/* Timestamp separator */}
                                            {showTimestamp && (
                                                <div className="flex items-center justify-center my-3">
                                                    <span className="text-[10px] text-muted-foreground/50 bg-muted/30 px-3 py-1 rounded-full font-medium">
                                                        {formatMessageTime(msg.created_at)}
                                                    </span>
                                                </div>
                                            )}
                                        <div
                                            className={cn(
                                                "flex flex-col gap-1.5 max-w-[85%] group relative",
                                                isMe ? "self-end items-end" : "self-start items-start",
                                                isSequence ? "mt-0.5" : "mt-4",
                                                isFailed && "opacity-70"
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
                                                                    onClick={() => setDeleteConfirmId(msg.id)} 
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
                                                
                                                {isMe && !isFailed && (
                                                    <div className="flex justify-end mt-1 -mr-1">
                                                        <div className={cn(
                                                            "text-[9px] flex items-center",
                                                            msg.is_read ? "text-blue-400" : "text-zinc-50/50"
                                                        )}>
                                                            {msg.is_read ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Failed message indicator */}
                                            {isFailed && (
                                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                                    <span className="text-[10px] text-red-500 font-medium">Error al enviar</span>
                                                    <button 
                                                        onClick={() => retryMessage(msg.id)}
                                                        className="text-[10px] text-primary font-bold underline underline-offset-2 ml-1 flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                        Reintentar
                                                    </button>
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

                        {/* Emoji Picker Popup */}
                        {showEmoji && (
                            <div className="absolute bottom-full mb-2 left-2 right-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <Picker 
                                    data={data} 
                                    onEmojiSelect={(emoji: any) => {
                                        setInputValue(prev => prev + emoji.native);
                                        setShowEmoji(false);
                                    }}
                                    theme="dark"
                                    locale="es"
                                    previewPosition="none"
                                    skinTonePosition="none"
                                    maxFrequentRows={2}
                                    perLine={8}
                                />
                            </div>
                        )}

                        <form onSubmit={handleSend} className="flex w-full items-center gap-1.5">
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
                                className="h-10 w-10 rounded-2xl shrink-0 text-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all active:scale-90"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-10 w-10 rounded-2xl shrink-0 transition-all active:scale-90",
                                    showEmoji ? "text-primary bg-primary/10" : "text-foreground/50 hover:text-foreground hover:bg-muted/50"
                                )}
                                onClick={() => setShowEmoji(!showEmoji)}
                            >
                                <Smile className="h-5 w-5" />
                            </Button>
                            <Input
                                placeholder="Escribe un mensaje..."
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    handleTypingInput();
                                }}
                                onPaste={handlePaste}
                                onFocus={() => setShowEmoji(false)}
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
                    className={cn(
                        "h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-zinc-900 dark:bg-zinc-800 text-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto relative group overflow-visible",
                        unreadCount > 0 && "ring-2 ring-red-500/60 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    )}
                    aria-label="Abrir chat de soporte"
                >
                    <div className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {unreadCount > 0 && (
                        <div className="absolute inset-[-4px] rounded-full border-2 border-red-500/40 animate-ping" />
                    )}
                    <MessageCircle className="h-7 w-7 relative z-10" />

                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex items-center justify-center z-20">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white border-[3px] border-background shadow-lg">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        </span>
                    )}
                </Button>
            )}
        </div>
    );
}
