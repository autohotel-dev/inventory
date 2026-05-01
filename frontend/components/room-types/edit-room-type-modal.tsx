"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RoomType } from "@/components/sales/room-types";

const formSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    base_price: z.coerce.number().min(0, "El precio base debe ser mayor o igual a 0"),
    weekday_hours: z.coerce.number().min(1, "Las horas entre semana deben ser al menos 1"),
    weekend_hours: z.coerce.number().min(1, "Las horas en fin de semana deben ser al menos 1"),
    extra_person_price: z.coerce.number().min(0).optional(),
    extra_hour_price: z.coerce.number().min(0).optional(),
    max_people: z.coerce.number().min(1, "Debe haber al menos 1 persona"),
    is_hotel: z.boolean().default(false),
});

interface EditRoomTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<RoomType>) => Promise<void>;
    roomType: RoomType | null;
    isLoading?: boolean;
}

export function EditRoomTypeModal({
    isOpen,
    onClose,
    onSave,
    roomType,
    isLoading
}: EditRoomTypeModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            base_price: 0,
            weekday_hours: 4,
            weekend_hours: 4,
            extra_person_price: 0,
            extra_hour_price: 0,
            max_people: 2,
            is_hotel: false,
        },
    });

    useEffect(() => {
        if (roomType) {
            reset({
                name: roomType.name,
                base_price: roomType.base_price || 0,
                weekday_hours: roomType.weekday_hours || 4,
                weekend_hours: roomType.weekend_hours || 4,
                extra_person_price: roomType.extra_person_price || 0,
                extra_hour_price: roomType.extra_hour_price || 0,
                max_people: roomType.max_people || 2,
                is_hotel: roomType.is_hotel || false,
            });
        } else {
            reset({
                name: "",
                base_price: 0,
                weekday_hours: 4,
                weekend_hours: 4,
                extra_person_price: 0,
                extra_hour_price: 0,
                max_people: 2,
                is_hotel: false,
            });
        }
    }, [roomType, reset, isOpen]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        await onSave(values);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{roomType ? "Editar Tipo de Habitación" : "Nuevo Tipo de Habitación"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            placeholder="Ej. Sencilla, Jacuzzi..."
                            {...register("name")}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="base_price">Precio Base</Label>
                            <Input
                                id="base_price"
                                type="number"
                                step="0.01"
                                {...register("base_price")}
                            />
                            {errors.base_price && (
                                <p className="text-sm text-destructive">{errors.base_price.message}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="max_people">Capacidad Máxima</Label>
                            <Input
                                id="max_people"
                                type="number"
                                {...register("max_people")}
                            />
                            {errors.max_people && (
                                <p className="text-sm text-destructive">{errors.max_people.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-muted/20">
                        <div className="col-span-2 text-sm font-medium text-muted-foreground mb-2">
                            Duración de la Estancia (Horas)
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="weekday_hours">Entre Semana</Label>
                            <Input
                                id="weekday_hours"
                                type="number"
                                {...register("weekday_hours")}
                            />
                            {errors.weekday_hours && (
                                <p className="text-sm text-destructive">{errors.weekday_hours.message}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="weekend_hours">Fin de Semana</Label>
                            <Input
                                id="weekend_hours"
                                type="number"
                                {...register("weekend_hours")}
                            />
                            {errors.weekend_hours && (
                                <p className="text-sm text-destructive">{errors.weekend_hours.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="extra_person_price">Costo Persona Extra</Label>
                            <Input
                                id="extra_person_price"
                                type="number"
                                step="0.01"
                                {...register("extra_person_price")}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="extra_hour_price">Costo Hora Extra</Label>
                            <Input
                                id="extra_hour_price"
                                type="number"
                                step="0.01"
                                {...register("extra_hour_price")}
                            />
                        </div>
                    </div>

                    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label htmlFor="is_hotel">Modo Hotel</Label>
                            <div className="text-xs text-muted-foreground">
                                Habilita el check-in/out por días en lugar de horas (si aplica)
                            </div>
                        </div>
                        {/* 
                          Controller is needed for Switch because it doesn't use standard unchecked value 
                          But typically with react-hook-form v7 we can use register too if the component supports ref.
                          However, shadcn Switch usually needs Controller.
                          Let's use Controller from react-hook-form.
                        */}
                        <Controller
                            control={control}
                            name="is_hotel"
                            render={({ field }) => (
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <DialogFooter className="gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
