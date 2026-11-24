FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release

WORKDIR /src

COPY ["VidaPlenaArchives.WebApi/VidaPlenaArchives.WebApi.csproj", "VidaPlenaArchives.WebApi/"]
RUN dotnet restore "./VidaPlenaArchives.WebApi/VidaPlenaArchives.WebApi.csproj"
COPY . .
WORKDIR "/src/VidaPlenaArchives.WebApi"
RUN dotnet build "./VidaPlenaArchives.WebApi.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./VidaPlenaArchives.WebApi.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish --chown app:app /app/publish .
USER app
ENTRYPOINT ["dotnet", "VidaPlenaArchives.WebApi.dll"]