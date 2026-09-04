import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, User, Phone, MapPin, FileText, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { profile, updateUserProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [city, setCity] = useState(profile?.city || "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync form fields once the profile loads (it may be null on first render)
  useEffect(() => {
    if (profile) {
      setName((prev) => prev || profile.name || "");
      setPhone((prev) => prev || profile.phone || "");
      setBio((prev) => prev || profile.bio || "");
      setCity((prev) => prev || profile.city || "");
      setPhotoUrl((prev) => prev || profile.photoUrl || "");
    }
  }, [profile?.id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      await updateUserProfile({ name: name.trim(), phone: phone.trim(), bio: bio.trim(), city: city.trim(), photoUrl });
      toast.success("Profile updated successfully");
      navigate("/profile");
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.name || "U")[0].toUpperCase();

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Edit Profile" showBack />
      <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-navy pb-6">
        <div className="p-4 space-y-4 max-w-lg mx-auto">

          <div className="card p-6 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-3xl">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-orange"
              >
                <Camera size={14} className="text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <p className="text-xs text-slate-400">Tap the camera icon to change your photo</p>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-navy dark:text-white">Personal Information</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Full Name *</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +27 82 000 0000"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">City</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Your city"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Bio</label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others a bit about yourself..."
                  rows={3}
                  className="input-field pl-10 resize-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
