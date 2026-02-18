import { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Shield, User, Loader2 } from "lucide-react";
import { api, type UserResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "./CreateUserDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ManageUsersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function ManageUsersSheet({ open, onOpenChange, currentUserId, isAdmin }: ManageUsersSheetProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { users: list } = await api.users.list();
      setUsers(list);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchUsers();
  }, [open]);

  const handleDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await api.users.delete(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setUserToDelete(null);
      toast({ title: "Deleted", description: "User deleted successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateRole = async (user: UserResponse, newRole: "ADMIN" | "USER") => {
    if (user.role === newRole) return;
    try {
      await api.users.updateRole(user.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      toast({ title: "Updated", description: `Role changed to ${newRole}` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Users
            </SheetTitle>
            <SheetDescription>
              Create, view, and manage user accounts. Admin only.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-4">
            {!isAdmin ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 text-center text-sm text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-2 text-destructive/60" />
                <p className="font-medium text-foreground">Admin access required</p>
                <p className="mt-1 text-xs">Only admins can manage users.</p>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="w-full"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </Button>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No users yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {users.length} user{users.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {users.map((user) => {
                    const isCurrent = user.id === currentUserId;
                    return (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3 rounded-lg border bg-card",
                          isCurrent && "ring-1 ring-primary/30"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {user.name || user.email}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <select
                              value={user.role}
                              onChange={(e) =>
                                handleUpdateRole(user, e.target.value as "ADMIN" | "USER")
                              }
                              className="text-[11px] px-2 py-0.5 rounded border border-border bg-background text-foreground"
                            >
                              <option value="USER">User</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                            {user.role === "ADMIN" ? (
                              <Shield className="w-3 h-3 text-primary" title="Admin" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" title="User" />
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setUserToDelete(user)}
                          disabled={isCurrent}
                          title={isCurrent ? "Cannot delete yourself" : "Delete user"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={(isOpen) => {
          setCreateDialogOpen(isOpen);
          if (!isOpen) fetchUsers();
        }}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {userToDelete?.email}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
