"""Tenant-scoped DB wrapper.

Transparently injects tenant_id into every query/insert/update for collections that
hold tenant-specific data. Exempt collections (e.g., 'tenants', 'push_tokens') are
passed through unchanged.

Usage:
    from tenant_db import get_tenant_db
    tdb = await get_tenant_db(request)  # scoped to current user's tenant
    docs = await tdb.properties.find({}).to_list(100)  # auto-filtered by tenant_id
    await tdb.properties.insert_one({...})  # auto-stamped with tenant_id
"""
from helpers import get_current_user

# Collections that should NOT be auto-scoped (system-wide or keyed differently)
EXEMPT_COLLECTIONS = {
    "tenants",  # tenants collection itself
    "push_tokens",  # keyed by user_id, not tenant
    "guest_otps",  # short-lived, keyed by user_id
    "demo_leads",  # marketing funnel, pre-signup
}

class TenantScopedCollection:
    def __init__(self, coll, tenant_id, bypass=False):
        self._coll = coll
        self._tid = tenant_id
        self._bypass = bypass

    def _q(self, filt):
        if self._bypass:
            return filt or {}
        f = dict(filt or {})
        # Don't double-filter if caller already specified tenant_id explicitly
        if "tenant_id" not in f:
            f["tenant_id"] = self._tid
        return f

    def _d(self, doc):
        d = dict(doc)
        if not self._bypass and "tenant_id" not in d:
            d["tenant_id"] = self._tid
        return d

    async def find_one(self, filt=None, *a, **kw):
        return await self._coll.find_one(self._q(filt), *a, **kw)

    def find(self, filt=None, *a, **kw):
        return self._coll.find(self._q(filt), *a, **kw)

    async def insert_one(self, doc, **kw):
        return await self._coll.insert_one(self._d(doc), **kw)

    async def insert_many(self, docs, **kw):
        return await self._coll.insert_many([self._d(d) for d in docs], **kw)

    async def update_one(self, filt, update, **kw):
        return await self._coll.update_one(self._q(filt), update, **kw)

    async def update_many(self, filt, update, **kw):
        return await self._coll.update_many(self._q(filt), update, **kw)

    async def delete_one(self, filt, **kw):
        return await self._coll.delete_one(self._q(filt), **kw)

    async def delete_many(self, filt, **kw):
        return await self._coll.delete_many(self._q(filt), **kw)

    async def count_documents(self, filt=None, **kw):
        return await self._coll.count_documents(self._q(filt or {}), **kw)

    def aggregate(self, pipeline, **kw):
        if not self._bypass:
            # Prepend a $match stage to scope the aggregation
            pipeline = [{"$match": {"tenant_id": self._tid}}] + list(pipeline)
        return self._coll.aggregate(pipeline, **kw)

    # Fallthroughs
    def __getattr__(self, name):
        return getattr(self._coll, name)


class TenantScopedDB:
    def __init__(self, raw_db, tenant_id, bypass=False):
        self._db = raw_db
        self._tid = tenant_id
        self._bypass = bypass

    def __getattr__(self, coll_name):
        coll = getattr(self._db, coll_name)
        if coll_name in EXEMPT_COLLECTIONS:
            return coll
        return TenantScopedCollection(coll, self._tid, self._bypass)

    def __getitem__(self, coll_name):
        return self.__getattr__(coll_name)


async def get_tenant_db(request):
    """FastAPI dependency-style helper. Returns a tenant-scoped DB for the current user.
    Platform admins get bypass=True (see all tenants' data).
    """
    raw_db = request.app.state.db
    user = await get_current_user(request, raw_db)
    bypass = bool(user.get("is_platform_admin"))
    return TenantScopedDB(raw_db, user.get("tenant_id", "default"), bypass=bypass), user
