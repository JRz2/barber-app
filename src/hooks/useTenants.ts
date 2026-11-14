import { supabase } from '@/src/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';

export type Tenant = {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    signedUrl?: string | null;
};

export function useTenants() {
    const queryClient = useQueryClient();

    const { data: tenants, isLoading, refetch } = useQuery({
        queryKey: ['tenants'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            // Generar URLs firmadas para los logos
            const tenantsWithLogos = await Promise.all(data.map(async (tenant: Tenant) => {
                let signedUrl = null;
                if (tenant.logo_url) {
                    const { data: urlData } = await supabase.storage
                        .from('logos')
                        .createSignedUrl(tenant.logo_url, 3600);
                    signedUrl = urlData?.signedUrl;
                }
                return { ...tenant, signedUrl };
            }));

            return tenantsWithLogos;
        },
    });

    const createTenantMutation = useMutation({
        mutationFn: async (newTenant: { name: string; address: string; phone: string; logoBase64?: string; logoExt?: string }) => {
            const { data, error } = await supabase
                .from('tenants')
                .insert({ name: newTenant.name, address: newTenant.address, phone: newTenant.phone })
                .select()
                .single();

            if (error) throw error;

            if (newTenant.logoBase64 && newTenant.logoExt) {
                const filePath = `${data.id}/logo.${newTenant.logoExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(filePath, decode(newTenant.logoBase64), {
                        contentType: `image/${newTenant.logoExt}`,
                        upsert: true,
                    });
                if (uploadError) throw uploadError;

                await supabase.from('tenants').update({ logo_url: filePath }).eq('id', data.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });

    const updateTenantMutation = useMutation({
        mutationFn: async (updatedTenant: { id: string; name: string; address: string; phone: string; logoBase64?: string; logoExt?: string }) => {
            const { error } = await supabase
                .from('tenants')
                .update({ name: updatedTenant.name, address: updatedTenant.address, phone: updatedTenant.phone })
                .eq('id', updatedTenant.id);
            if (error) throw error;

            if (updatedTenant.logoBase64 && updatedTenant.logoExt) {
                const filePath = `${updatedTenant.id}/logo.${updatedTenant.logoExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(filePath, decode(updatedTenant.logoBase64), {
                        contentType: `image/${updatedTenant.logoExt}`,
                        upsert: true,
                    });
                if (uploadError) throw uploadError;

                await supabase.from('tenants').update({ logo_url: filePath }).eq('id', updatedTenant.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });

    const deleteTenantMutation = useMutation({
        mutationFn: async (tenantId: string) => {
            // Al eliminar el tenant, si hay usuarios asociados, su tenant_id se pondrá en NULL (ON DELETE SET NULL)
            const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
        },
    });

    return {
        tenants: tenants || [],
        isLoading,
        refetch,
        createTenant: createTenantMutation.mutateAsync,
        updateTenant: updateTenantMutation.mutateAsync,
        deleteTenant: deleteTenantMutation.mutateAsync,
        isCreating: createTenantMutation.isPending,
        isUpdating: updateTenantMutation.isPending,
        isDeleting: deleteTenantMutation.isPending,
    };
}