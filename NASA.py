import xarray as xr
import matplotlib.pyplot as plt

# Autenticación (tus credenciales)
username = "wolmerson"
password = "Osigermin.123"  # <-- cámbialo por tu contraseña real de Earthdata

# URL OPeNDAP del dataset IMERG Final Run (ejemplo marzo 2023)
url = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGHH.07/2023/03/3B-HHR.MS.MRG.3IMERG.20230301-S000000-E002959.0000.V07B.HDF5"

# Abrir con xarray usando credenciales
ds = xr.open_dataset(url, engine="netcdf4", backend_kwargs={'auth': (username, password)})

print(ds)

# Seleccionar variable de precipitación
precip = ds["precipitationCal"]

# Graficar un mapa rápido
plt.figure(figsize=(10,6))
precip.isel(time=0).plot(cmap="Blues")
plt.title("Precipitación IMERG (mm/hr) - 1 Marzo 2023")
plt.show()
