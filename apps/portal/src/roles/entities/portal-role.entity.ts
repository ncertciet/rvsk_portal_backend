import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * RVSK-RBAC-ROLE-002-A — Role master.
 *
 * `role_code` is the stable authorization key (equal to the legacy
 * portal_users.role / role_page_defaults_v2.role strings, e.g. 'Super_Admin').
 * `id` is an internal surrogate FK target (portal_users.role_id references it).
 *
 * The table is created + seeded by migration 1758900000000-CreatePortalRole.
 */
@Entity({ name: 'portal_role', schema: 'rvsk_portal' })
export class PortalRole {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'role_code', nullable: false, length: 50, unique: true })
  roleCode: string;

  @Column({ name: 'role_name', nullable: false, length: 100 })
  roleName: string;

  @Column({ name: 'description', nullable: true, length: 255 })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
