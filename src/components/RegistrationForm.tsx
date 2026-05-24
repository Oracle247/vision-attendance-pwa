import {
  useState,
  useEffect,
  useMemo,
  useImperativeHandle,
  forwardRef,
  SubmitEventHandler,
  FocusEvent,
  FormEvent,
} from "react";
import { Loader2, UserPlus, X, Search } from "lucide-react";
import { departmentService, IDepartment } from "@/lib/attendanceService";
import { NIGERIA_STATES } from "@/data/nigeria-states";
import { NATIONALITIES } from "@/data/nationalities";

// Parents reset internal state (chips, search, touched, errors) via the ref's
// reset() method. Tab selection is intentionally preserved across resets so the
// user can register multiple Workers (or Non-Workers) without re-selecting.
export interface RegistrationFormHandle {
  reset(): void;
}

interface RegistrationFormProps {
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly isSubmitting: boolean;
  readonly submitLabel?: string;
  readonly fieldErrors?: Record<string, string>;
}

const inputClass =
  "border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full";

const errorInputClass =
  "border border-red-400 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-full bg-red-50";

const MATRIC_PATTERN = "^(UG|PG|DE)\\/\\d{2}\\/\\d{3,5}$";
const MATRIC_REGEX = /^(UG|PG|DE)\/\d{2}\/\d{3,5}$/;
const MATRIC_MSG =
  "Format: UG/PG/DE/YY/NNN (e.g. UG/20/1234)";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MemberTab = "non-worker" | "worker";

const REQUIRED_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "address",
  "gender",
]);

function validateField(name: string, value: string, tab: MemberTab): string {
  const trimmed = value.trim();
  if (REQUIRED_FIELDS.has(name) && !trimmed) return "Required";
  if (name === "churchStatus" && tab === "non-worker" && !trimmed) return "Required";
  if (name === "email" && trimmed && !EMAIL_REGEX.test(trimmed)) return "Invalid email";
  if (name === "phoneNumber" && trimmed && trimmed.replace(/\D/g, "").length < 7) {
    return "Invalid phone number";
  }
  if (name === "matricNumber" && trimmed && !MATRIC_REGEX.test(trimmed)) {
    return MATRIC_MSG;
  }
  return "";
}

function FieldError({ message }: { readonly message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

function inputCls(hasError: boolean) {
  return hasError ? errorInputClass : inputClass;
}

const RegistrationForm = forwardRef<RegistrationFormHandle, RegistrationFormProps>(function RegistrationForm(
  {
    onSubmit,
    isSubmitting,
    submitLabel = "Register & Mark Attendance",
    fieldErrors = {},
  },
  ref,
) {
  const [tab, setTab] = useState<MemberTab>("non-worker");
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deptSearch, setDeptSearch] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  // Mirror form values so submit-button validity can be derived from React
  // state (no DOM reads, no setState-in-effect). Populated via the form's
  // onInput handler which bubbles from every named input/select.
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const isFormValid = useMemo(() => {
    const get = (k: string) => (formValues[k] ?? "").trim();
    const required = ["firstName", "lastName", "email", "phoneNumber", "address", "gender"];
    for (const f of required) {
      if (!get(f)) return false;
    }
    if (tab === "non-worker" && !get("churchStatus")) return false;
    const email = get("email");
    if (email && !EMAIL_REGEX.test(email)) return false;
    const phone = get("phoneNumber");
    if (phone && phone.replace(/\D/g, "").length < 7) return false;
    if (tab === "worker") {
      const matric = get("matricNumber");
      if (matric && !MATRIC_REGEX.test(matric)) return false;
      if (selectedDepts.length === 0) return false;
    }
    return true;
  }, [formValues, tab, selectedDepts]);

  const handleFormInput = (e: FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target?.name) return;
    setFormValues((prev) => ({ ...prev, [target.name]: target.value }));
  };

  useEffect(() => {
    departmentService
      .getAll()
      .then((res) => {
        if (res?.data) setDepartments(res.data);
        else if (Array.isArray(res)) setDepartments(res);
      })
      .catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({
    reset() {
      setSelectedDepts([]);
      setDeptSearch("");
      setTouched({});
      setClientErrors({});
      setFormValues({});
    },
  }), []);

  const switchTab = (next: MemberTab) => {
    if (next === tab) return;
    setTab(next);
    setTouched({});
    setClientErrors({});
    // Drop values for fields that just unmounted so they don't taint validity
    // when the user types into them on this tab and switches away.
    const drop = tab === "worker"
      ? ["workerType", "dateOfBirth", "matricNumber", "nationality", "stateOfOrigin", "emergencyContact"]
      : ["churchStatus"];
    setFormValues((v) => {
      const next2 = { ...v };
      for (const k of drop) delete next2[k];
      return next2;
    });
  };

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleBlur = (
    e: FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (!name) return;
    setTouched((t) => ({ ...t, [name]: true }));
    const msg = validateField(name, value, tab);
    setClientErrors((errs) => {
      if (msg === errs[name]) return errs;
      const next = { ...errs };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const errFor = (name: string): string | undefined => {
    if (touched[name]) return clientErrors[name];
    return fieldErrors[name];
  };

  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, deptSearch]);

  const tabClass = (t: MemberTab) =>
    `flex-1 py-2.5 text-sm font-medium rounded-lg text-center cursor-pointer transition-all ${
      tab === t
        ? "bg-emerald-600 text-white"
        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
    }`;

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => switchTab("non-worker")}
          className={tabClass("non-worker")}
        >
          Non-Worker
        </button>
        <button
          type="button"
          onClick={() => switchTab("worker")}
          className={tabClass("worker")}
        >
          Worker
        </button>
      </div>

      <form onSubmit={onSubmit} onInput={handleFormInput} className="space-y-3" noValidate>
        {/* Hidden fields */}
        <input
          type="hidden"
          name="membershipType"
          value={tab === "worker" ? "WORKER" : "NON_WORKER"}
        />
        {tab === "worker" && (
          <>
            <input type="hidden" name="workerType" value="REGULAR" />
            {/* Workers are auto-set to MEMBER status */}
            <input type="hidden" name="churchStatus" value="MEMBER" />
          </>
        )}
        {selectedDepts.map((id) => (
          <input key={id} type="hidden" name="departmentIds" value={id} />
        ))}

        {/* Common fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <input
              type="text"
              name="firstName"
              placeholder="First Name *"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("firstName"))}
            />
            <FieldError message={errFor("firstName")} />
          </div>
          <div>
            <input
              type="text"
              name="lastName"
              placeholder="Last Name *"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("lastName"))}
            />
            <FieldError message={errFor("lastName")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email *"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("email"))}
            />
            <FieldError message={errFor("email")} />
          </div>
          <div>
            <input
              type="text"
              name="phoneNumber"
              placeholder="Phone Number *"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("phoneNumber"))}
            />
            <FieldError message={errFor("phoneNumber")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <select
              name="gender"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("gender"))}
            >
              <option value="">Gender *</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            <FieldError message={errFor("gender")} />
          </div>
          <div>
            <input
              type="text"
              name="level"
              placeholder="Level"
              onBlur={handleBlur}
              className={inputCls(!!errFor("level"))}
            />
            <FieldError message={errFor("level")} />
          </div>
        </div>

        <div>
          <input
            type="text"
            name="address"
            placeholder="Address *"
            required
            onBlur={handleBlur}
            className={inputCls(!!errFor("address"))}
          />
          <FieldError message={errFor("address")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <input
              type="text"
              name="faculty"
              placeholder="Faculty"
              onBlur={handleBlur}
              className={inputCls(!!errFor("faculty"))}
            />
            <FieldError message={errFor("faculty")} />
          </div>
          <div>
            <input
              type="text"
              name="department"
              placeholder="Department (Academic)"
              onBlur={handleBlur}
              className={inputCls(!!errFor("department"))}
            />
            <FieldError message={errFor("department")} />
          </div>
        </div>

        {/* Church status: only shown on Non-Worker tab. Worker tab auto-sets MEMBER. */}
        {tab === "non-worker" && (
          <div>
            <select
              name="churchStatus"
              required
              onBlur={handleBlur}
              className={inputCls(!!errFor("churchStatus"))}
            >
              <option value="">Church Status *</option>
              <option value="FIRST_TIMER">First Timer</option>
              <option value="VISITOR">Visitor</option>
              <option value="MEMBER">Member</option>
            </select>
            <FieldError message={errFor("churchStatus")} />
          </div>
        )}

        {/* Worker-only fields */}
        {tab === "worker" && (
          <>
            <div className="border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">
                Worker Details
              </p>
            </div>
            <div>
              <select
                name="workerType"
                defaultValue="REGULAR"
                onBlur={handleBlur}
                className={inputCls(!!errFor("workerType"))}
              >
                <option value="REGULAR">Regular Worker</option>
                <option value="EXECUTIVE">Executive Worker</option>
              </select>
              <FieldError message={errFor("workerType")} />
            </div>

            {/* Church Departments (multi-select with search) */}
            <div>
              <p className="text-sm text-gray-500 mb-1.5">Church Departments *</p>
              {selectedDepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedDepts.map((id) => {
                    const dept = departments.find((d) => d.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200"
                      >
                        {dept?.name}
                        <button
                          type="button"
                          onClick={() => toggleDept(id)}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="relative mb-1.5">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder="Search departments..."
                  className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="border border-gray-300 rounded-lg max-h-[160px] overflow-y-auto">
                {departments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    No departments found
                  </p>
                ) : filteredDepartments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    No match for "{deptSearch}"
                  </p>
                ) : (
                  filteredDepartments.map((dept) => (
                    <label
                      key={dept.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDepts.includes(dept.id)}
                        onChange={() => toggleDept(dept.id)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">{dept.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedDepts.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Select at least one department
                </p>
              )}
              <FieldError message={errFor("departmentIds")} />
            </div>

            <div>
              <input
                type="text"
                name="dateOfBirth"
                placeholder="Date of Birth"
                onFocus={(e) => (e.target.type = "date")}
                onBlur={(e) => {
                  if (!e.target.value) e.target.type = "text";
                  handleBlur(e);
                }}
                className={inputCls(!!errFor("dateOfBirth"))}
              />
              <FieldError message={errFor("dateOfBirth")} />
            </div>

            <div>
              <input
                type="text"
                name="matricNumber"
                placeholder="Matric Number (e.g. UG/20/1234)"
                pattern={MATRIC_PATTERN}
                title={MATRIC_MSG}
                onInvalid={(e) =>
                  (e.target as HTMLInputElement).setCustomValidity(MATRIC_MSG)
                }
                onInput={(e) =>
                  (e.target as HTMLInputElement).setCustomValidity("")
                }
                onBlur={handleBlur}
                className={inputCls(!!errFor("matricNumber"))}
              />
              <FieldError message={errFor("matricNumber")} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  name="nationality"
                  list="nationality-options"
                  placeholder="Nationality"
                  autoComplete="off"
                  onBlur={handleBlur}
                  className={inputCls(!!errFor("nationality"))}
                />
                <datalist id="nationality-options">
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <FieldError message={errFor("nationality")} />
              </div>
              <div>
                <input
                  type="text"
                  name="stateOfOrigin"
                  list="state-options"
                  placeholder="State of Origin"
                  autoComplete="off"
                  onBlur={handleBlur}
                  className={inputCls(!!errFor("stateOfOrigin"))}
                />
                <datalist id="state-options">
                  {NIGERIA_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <FieldError message={errFor("stateOfOrigin")} />
              </div>
            </div>

            <div>
              <input
                type="text"
                name="emergencyContact"
                placeholder="Emergency Contact"
                onBlur={handleBlur}
                className={inputCls(!!errFor("emergencyContact"))}
              />
              <FieldError message={errFor("emergencyContact")} />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {submitLabel}
        </button>
      </form>
    </div>
  );
});

export default RegistrationForm;
